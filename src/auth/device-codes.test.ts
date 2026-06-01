import { test, expect } from 'bun:test';
import { createTestDb } from '@/db/test-db';
import { signupUser } from './users';
import {
  initDeviceCode,
  lookupByUserCode,
  approveDeviceCode,
  pollDeviceCode,
  DEVICE_CODE_TTL_MS,
} from './device-codes';
import { AppError } from '@/lib/errors';
import { mockNow } from '@/lib/time';

test('initDeviceCode returns codes with proper shapes + expiry', async () => {
  const db = await createTestDb();
  const r = await initDeviceCode(db, { label: 'claude-code-laptop' });
  expect(r.deviceCode).toHaveLength(43);
  expect(r.userCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  expect(r.expiresAt).toBeGreaterThan(Date.now());
});

test('lookupByUserCode finds an unapproved code', async () => {
  const db = await createTestDb();
  const r = await initDeviceCode(db, { label: 't' });
  const found = await lookupByUserCode(db, r.userCode);
  expect(found?.status).toBe('pending');
});

test('approveDeviceCode binds user and marks approved', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await initDeviceCode(db, { label: 't' });
  await approveDeviceCode(db, r.userCode, u.id);
  const found = await lookupByUserCode(db, r.userCode);
  expect(found?.status).toBe('approved');
  expect(found?.userId).toBe(u.id);
});

test('pollDeviceCode returns pending status while not approved', async () => {
  const db = await createTestDb();
  const r = await initDeviceCode(db, { label: 't' });
  const polled = await pollDeviceCode(db, r.deviceCode);
  expect(polled.status).toBe('pending');
  expect(polled.token).toBeUndefined();
});

test('pollDeviceCode exchanges approved code for a token (once)', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  const r = await initDeviceCode(db, { label: 't' });
  await approveDeviceCode(db, r.userCode, u.id);
  const first = await pollDeviceCode(db, r.deviceCode);
  expect(first.status).toBe('exchanged');
  expect(first.token).toMatch(/^lp_/);
  // A second poll should NOT re-issue a token
  const second = await pollDeviceCode(db, r.deviceCode);
  expect(second.status).toBe('exchanged');
  expect(second.token).toBeUndefined();
});

test('pollDeviceCode returns expired after TTL', async () => {
  const db = await createTestDb();
  mockNow(1_000_000_000_000);
  const r = await initDeviceCode(db, { label: 't' });
  mockNow(1_000_000_000_000 + DEVICE_CODE_TTL_MS + 1);
  const polled = await pollDeviceCode(db, r.deviceCode);
  expect(polled.status).toBe('expired');
  mockNow(null);
});

test('approveDeviceCode throws for unknown user_code', async () => {
  const db = await createTestDb();
  const u = await signupUser(db, { email: 'a@b.c', password: 'hunter2hunter2', displayName: 'A' });
  await expect(approveDeviceCode(db, 'AAAA-AAAA', u.id)).rejects.toThrow(AppError);
});

test('pollDeviceCode throws not_found for unknown device_code', async () => {
  const db = await createTestDb();
  await expect(pollDeviceCode(db, 'nope')).rejects.toThrow(AppError);
});
