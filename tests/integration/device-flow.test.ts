import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { buildApp } from '@/server';

test('full device flow: init → approve via session → poll → exchanged with token', async () => {
  const testDb = await createTestDb();
  const app = buildApp({ db: testDb, publicBaseUrl: 'http://x' });

  // 1. Init device code
  const initRes = await app.request('/api/device/code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ label: 'e2e' }),
  });
  expect(initRes.status).toBe(200);
  const init = (await initRes.json()) as { deviceCode: string; userCode: string };

  // 2. Poll before approval → pending
  const pending = await app.request('/api/device/poll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceCode: init.deviceCode }),
  });
  expect(((await pending.json()) as { status: string }).status).toBe('pending');

  // 3. Sign up (creates user + sets cookie)
  const signup = await app.request('/api/app/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'dev@e2e', password: 'hunter2hunter2', displayName: 'Dev' }),
  });
  const cookie = signup.headers.get('set-cookie') ?? '';

  // 4. Approve the code as the logged-in user
  const approve = await app.request('/api/device/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ userCode: init.userCode }),
  });
  expect(approve.status).toBe(200);

  // 5. Poll → exchanged + token
  const exchanged = await app.request('/api/device/poll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceCode: init.deviceCode }),
  });
  const exBody = (await exchanged.json()) as { status: string; token?: string };
  expect(exBody.status).toBe('exchanged');
  expect(exBody.token).toMatch(/^lp_/);

  // 6. Token works on MCP — try a tools/list call
  const mcp = await app.request('/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${exBody.token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  expect(mcp.status).toBe(200);
  const mcpText = await mcp.text();
  let mcpBody: { result: { tools: Array<{ name: string }> } };
  try {
    mcpBody = JSON.parse(mcpText);
  } catch {
    const dataLine = mcpText.split('\n').find((l) => l.startsWith('data:'));
    if (!dataLine) throw new Error(`bad: ${mcpText}`);
    mcpBody = JSON.parse(dataLine.slice(5).trim());
  }
  expect(mcpBody.result.tools.map((t) => t.name)).toContain('create_request');

  // 7. Second poll on already-exchanged returns exchanged but no token (no leak)
  const second = await app.request('/api/device/poll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceCode: init.deviceCode }),
  });
  const secondBody = (await second.json()) as { status: string; token?: string };
  expect(secondBody.status).toBe('exchanged');
  expect(secondBody.token).toBeUndefined();
});
