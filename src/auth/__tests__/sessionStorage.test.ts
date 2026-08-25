import * as SecureStore from 'expo-secure-store';
import type { MemberSession } from '../../api/types';
import {
  __sessionKeyForTests,
  clearPersistedSession,
  isSessionExpired,
  readPersistedSession,
  writePersistedSession,
} from '../sessionStorage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const session: MemberSession = {
  token: 'bs_valid-session-token',
  expiresAt: '2030-01-01T00:00:00.000Z',
  user: {
    id: 'user-1',
    email: 'bankaci@example.com',
    revenueCatUserId: 'rc_user-1',
    displayName: 'Burak',
    bio: '',
    bankName: '',
    jobTitle: '',
    avatarUrl: null,
    isPremium: false,
    premiumExpiresAt: null,
    createdAt: '2026-08-25T00:00:00.000Z',
  },
};

describe('sessionStorage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('persists and restores a valid session', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(session));
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    await writePersistedSession(session);
    await expect(readPersistedSession()).resolves.toEqual(session);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      __sessionKeyForTests,
      JSON.stringify(session)
    );
  });

  it('clears corrupt persisted data', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('{broken');
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

    await expect(readPersistedSession()).resolves.toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(__sessionKeyForTests);
  });

  it('detects expiry without expiring an active session', () => {
    expect(isSessionExpired(session, new Date('2029-01-01').getTime())).toBe(false);
    expect(isSessionExpired(session, new Date('2031-01-01').getTime())).toBe(true);
  });

  it('clears the persisted session explicitly on logout', async () => {
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    await clearPersistedSession();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(__sessionKeyForTests);
  });
});
