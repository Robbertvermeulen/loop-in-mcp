import { test, expect } from 'bun:test';
import { Hono } from 'hono';
import { createTestDb } from '@/db/test-db';
import { signupUser } from '@/auth/users';
import { createSession, SESSION_TTL_MS } from '@/auth/sessions';
import { initDeviceCode, approveDeviceCode } from '@/auth/device-codes';
import { buildDeviceApi } from './device';
import { errorMiddleware } from '@/middleware/error';
import { SESSION_COOKIE } from '@/middleware/cookie-auth';

async function build() {
  const db = await createTestDb();
  const app = new Hono();
  app.onError(errorMiddleware);
  app.route('/api/device', buildDeviceApi(db, 'http://x'));
  return { app, db };
}

test('POST /api/device/code returns deviceCode + userCode + verificationUri', async () => {
  const { app } = await build();
  const res = await app.request('/api/device/code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ label: 'claude-code-laptop' }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { deviceCode: string; userCode: string; verificationUri: string; expiresIn: number };
  expect(body.deviceCode).toBeTruthy();
  expect(body.userCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  expect(body.verificationUri).toContain('/device');
  expect(body.expiresIn).toBeGreaterThan(0);
});

test('POST /api/device/code requires label', async () => {
  const { app } = await build();
  const res = await app.request('/api/device/code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
});

test('POST /api/device/poll returns pending → exchanged with token', async () => {
  const { app, db } = await build();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const init = await initDeviceCode(db, { label: 't' });

  // Pending first
  const pending = await app.request('/api/device/poll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceCode: init.deviceCode }),
  });
  expect(pending.status).toBe(200);
  expect(((await pending.json()) as { status: string }).status).toBe('pending');

  // Approve
  await approveDeviceCode(db, init.userCode, u.id);

  // Exchange
  const exchanged = await app.request('/api/device/poll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceCode: init.deviceCode }),
  });
  const body = (await exchanged.json()) as { status: string; token?: string };
  expect(body.status).toBe('exchanged');
  expect(body.token).toMatch(/^lp_/);
});

test('POST /api/device/approve approves a code for the logged-in user', async () => {
  const { app, db } = await build();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const session = await createSession(db, u.id);
  const init = await initDeviceCode(db, { label: 't' });

  const res = await app.request('/api/device/approve', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Cookie: `${SESSION_COOKIE}=${session.id}`,
    },
    body: JSON.stringify({ userCode: init.userCode }),
  });
  expect(res.status).toBe(200);
});

test('POST /api/device/approve rejects without session', async () => {
  const { app, db } = await build();
  const init = await initDeviceCode(db, { label: 't' });
  const res = await app.request('/api/device/approve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userCode: init.userCode }),
  });
  expect(res.status).toBe(401);
});
