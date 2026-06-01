import { Hono } from 'hono';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import type { User } from '@/db/schema';
import { initDeviceCode, pollDeviceCode, approveDeviceCode, DEVICE_CODE_TTL_MS } from '@/auth/device-codes';
import { cookieAuth } from '@/middleware/cookie-auth';
import { AppError } from '@/lib/errors';

export function buildDeviceApi(db: DB | TestDB, publicBaseUrl: string) {
  const r = new Hono<{ Variables: { user?: User } }>();
  r.use('*', cookieAuth(db));

  r.post('/code', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { label?: string } | null;
    if (!body || typeof body.label !== 'string' || !body.label.trim()) {
      throw new AppError('validation_failed', 'label required', 400);
    }
    const init = await initDeviceCode(db, { label: body.label.trim() });
    return c.json({
      deviceCode: init.deviceCode,
      userCode: init.userCode,
      verificationUri: `${publicBaseUrl}/device`,
      verificationUriComplete: `${publicBaseUrl}/device?code=${init.userCode}`,
      expiresIn: Math.floor(DEVICE_CODE_TTL_MS / 1000),
      interval: 2,
    });
  });

  r.post('/poll', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { deviceCode?: string } | null;
    if (!body || typeof body.deviceCode !== 'string') {
      throw new AppError('validation_failed', 'deviceCode required', 400);
    }
    const result = await pollDeviceCode(db, body.deviceCode);
    return c.json(result);
  });

  r.post('/approve', async (c) => {
    const user = c.get('user');
    if (!user) throw new AppError('auth_failed', 'Login required', 401);
    const body = (await c.req.json().catch(() => null)) as { userCode?: string } | null;
    if (!body || typeof body.userCode !== 'string') {
      throw new AppError('validation_failed', 'userCode required', 400);
    }
    await approveDeviceCode(db, body.userCode, user.id);
    return c.json({ ok: true });
  });

  return r;
}
