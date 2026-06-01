import { eq, and } from 'drizzle-orm';
import type { DB } from '@/db/client';
import type { TestDB } from '@/db/test-db';
import { deviceCodes, type DeviceCode } from '@/db/schema';
import { newUlid, newUrlSafeToken } from '@/lib/ids';
import { now } from '@/lib/time';
import { AppError } from '@/lib/errors';
import { createApiToken } from './tokens';

type AnyDb = DB | TestDB;

export const DEVICE_CODE_TTL_MS = 1000 * 60 * 15; // 15 minutes

function generateUserCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
  const pick = () => alphabet[Math.floor(Math.random() * alphabet.length)];
  return Array.from({ length: 4 }, pick).join('') + '-' + Array.from({ length: 4 }, pick).join('');
}

export interface InitResult {
  deviceCode: string;
  userCode: string;
  expiresAt: number;
}

export async function initDeviceCode(
  db: AnyDb,
  input: { label: string }
): Promise<InitResult> {
  const id = newUlid();
  const deviceCode = newUrlSafeToken();
  // Retry if userCode collides (very unlikely; ~1 in a million per pair)
  let userCode = generateUserCode();
  for (let i = 0; i < 5; i += 1) {
    const existing = await db.select().from(deviceCodes).where(eq(deviceCodes.userCode, userCode)).limit(1);
    if (existing.length === 0) break;
    userCode = generateUserCode();
  }
  const expiresAt = now() + DEVICE_CODE_TTL_MS;
  await db.insert(deviceCodes).values({
    id,
    deviceCode,
    userCode,
    userId: null,
    label: input.label,
    status: 'pending',
    issuedTokenId: null,
    approvedAt: null,
    exchangedAt: null,
    expiresAt,
    createdAt: now(),
  });
  return { deviceCode, userCode, expiresAt };
}

export async function lookupByUserCode(db: AnyDb, userCode: string): Promise<DeviceCode | null> {
  const rows = await db.select().from(deviceCodes).where(eq(deviceCodes.userCode, userCode)).limit(1);
  return rows[0] ?? null;
}

export async function approveDeviceCode(db: AnyDb, userCode: string, userId: string): Promise<void> {
  const found = await lookupByUserCode(db, userCode);
  if (!found) throw new AppError('not_found', 'Invalid code', 404);
  if (found.status !== 'pending') {
    throw new AppError('conflict', `Code already ${found.status}`, 409);
  }
  if (found.expiresAt < now()) {
    await db.update(deviceCodes).set({ status: 'expired' }).where(eq(deviceCodes.id, found.id));
    throw new AppError('conflict', 'Code expired', 410);
  }
  await db
    .update(deviceCodes)
    .set({ status: 'approved', userId, approvedAt: now() })
    .where(and(eq(deviceCodes.id, found.id), eq(deviceCodes.status, 'pending')));
}

export interface PollResult {
  status: 'pending' | 'approved' | 'exchanged' | 'expired';
  token?: string;
}

export async function pollDeviceCode(db: AnyDb, deviceCode: string): Promise<PollResult> {
  const rows = await db
    .select()
    .from(deviceCodes)
    .where(eq(deviceCodes.deviceCode, deviceCode))
    .limit(1);
  const found = rows[0];
  if (!found) throw new AppError('not_found', 'Unknown device code', 404);

  if (found.expiresAt < now() && found.status !== 'exchanged') {
    await db
      .update(deviceCodes)
      .set({ status: 'expired' })
      .where(and(eq(deviceCodes.id, found.id), eq(deviceCodes.status, 'pending')));
    return { status: 'expired' };
  }

  if (found.status === 'pending') return { status: 'pending' };
  if (found.status === 'expired') return { status: 'expired' };

  if (found.status === 'approved' && found.userId) {
    // Atomically claim the exchange first (no token created yet)
    const claimed = await db
      .update(deviceCodes)
      .set({ status: 'exchanged', exchangedAt: now() })
      .where(and(eq(deviceCodes.id, found.id), eq(deviceCodes.status, 'approved')))
      .returning({ id: deviceCodes.id, userId: deviceCodes.userId });

    if (claimed.length === 0) {
      // Lost the race — someone else won. Don't create a token.
      return { status: 'exchanged' };
    }

    // We won. Create the token and link it.
    const { plain, id: tokenId } = await createApiToken(db, found.userId, found.label);
    await db
      .update(deviceCodes)
      .set({ issuedTokenId: tokenId })
      .where(eq(deviceCodes.id, found.id));
    return { status: 'exchanged', token: plain };
  }

  // already exchanged — no token returned
  return { status: 'exchanged' };
}
