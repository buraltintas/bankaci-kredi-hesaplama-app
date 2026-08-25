import * as SecureStore from 'expo-secure-store';
import type { MemberSession } from '../api/types';

const SESSION_KEY = 'bankaci.member-session.v1';

const isMemberSession = (value: unknown): value is MemberSession => {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<MemberSession>;
  return (
    typeof session.token === 'string' &&
    session.token.startsWith('bs_') &&
    typeof session.expiresAt === 'string' &&
    Number.isFinite(new Date(session.expiresAt).getTime()) &&
    Boolean(session.user) &&
    typeof session.user?.id === 'string' &&
    typeof session.user?.email === 'string' &&
    typeof session.user?.revenueCatUserId === 'string'
  );
};

export const isSessionExpired = (
  session: MemberSession,
  now = Date.now()
): boolean => new Date(session.expiresAt).getTime() <= now;

export const readPersistedSession = async (): Promise<MemberSession | null> => {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isMemberSession(parsed)) return parsed;
  } catch {
    // Corrupt or partial writes must never trap the app in a broken auth state.
  }

  await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
  return null;
};

export const writePersistedSession = (session: MemberSession): Promise<void> =>
  SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));

export const clearPersistedSession = (): Promise<void> =>
  SecureStore.deleteItemAsync(SESSION_KEY);

export const __sessionKeyForTests = SESSION_KEY;
