import React from 'react';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import TestRenderer, { act } from 'react-test-renderer';
import { apiRequest } from '../api/client';
import { PushNotificationProvider } from './PushNotificationProvider';
import { setStoredExpoPushToken } from './pushTokenStorage';

const mockUseAuth = jest.fn();
const mockDeviceState = { isDevice: true };
const mockPushTokenListener: { callback: (() => void) | null } = {
  callback: null,
};

jest.mock('../auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../api/client', () => {
  class MockAPIError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(mockStatus: number, mockCode: string) {
      super(mockCode);
      this.status = mockStatus;
      this.code = mockCode;
    }
  }
  return { APIError: MockAPIError, apiRequest: jest.fn() };
});

jest.mock('./pushTokenStorage', () => ({
  getStoredExpoPushToken: jest.fn().mockResolvedValue(null),
  setStoredExpoPushToken: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../navigation/navigationRef', () => ({
  navigationRef: { isReady: () => false, navigate: jest.fn() },
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('expo-device', () => ({
  get isDevice() {
    return mockDeviceState.isDevice;
  },
  deviceName: 'Test Device',
  modelName: 'Test Model',
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: { eas: { projectId: 'f5c8092a-cb6e-4bbc-b316-aad23f8d0e87' } },
    },
    easConfig: null,
  },
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn(),
  })),
  addPushTokenListener: jest.fn((callback: () => void) => {
    mockPushTokenListener.callback = callback;
    return { remove: jest.fn() };
  }),
  getExpoPushTokenAsync: jest.fn(),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  setNotificationHandler: jest.fn(),
}));

const grantedPermission = {
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
} as unknown as Notifications.NotificationPermissionsStatus;

const preferences = {
  requests: true,
  feed: true,
  announcements: true,
};

const flushEffects = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe('PushNotificationProvider registration', () => {
  const apiRequestMock = apiRequest as jest.MockedFunction<typeof apiRequest>;
  const getPermissionsMock =
    Notifications.getPermissionsAsync as jest.MockedFunction<
      typeof Notifications.getPermissionsAsync
    >;
  const getExpoPushTokenMock =
    Notifications.getExpoPushTokenAsync as jest.MockedFunction<
      typeof Notifications.getExpoPushTokenAsync
    >;
  const requestPermissionsMock =
    Notifications.requestPermissionsAsync as jest.MockedFunction<
      typeof Notifications.requestPermissionsAsync
    >;
  const constantsModule = Constants as typeof Constants & {
    expoConfig: typeof Constants.expoConfig;
  };
  const originalProjectId =
    Constants.expoConfig?.extra?.eas?.projectId as string;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockUseAuth.mockReturnValue({ session: null });
    mockDeviceState.isDevice = true;
    mockPushTokenListener.callback = null;
    if (constantsModule.expoConfig?.extra?.eas) {
      constantsModule.expoConfig.extra.eas.projectId = originalProjectId;
    }
    getPermissionsMock.mockResolvedValue(grantedPermission);
    requestPermissionsMock.mockResolvedValue(grantedPermission);
    getExpoPushTokenMock.mockResolvedValue({
      type: 'expo',
      data: 'ExpoPushToken[test]',
    });
    apiRequestMock.mockResolvedValue(preferences);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers a guest device with the public endpoint', async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PushNotificationProvider>child</PushNotificationProvider>
      );
    });
    await flushEffects();

    expect(getExpoPushTokenMock).toHaveBeenCalledWith({
      projectId: originalProjectId,
    });
    expect(apiRequestMock).toHaveBeenCalledWith('/v1/devices', {
      method: 'POST',
      body: expect.objectContaining({
        platform: expect.any(String),
        token: 'ExpoPushToken[test]',
      }),
    });
    expect(setStoredExpoPushToken).toHaveBeenCalledWith(
      'ExpoPushToken[test]'
    );
    tree.unmount();
  });

  it('moves registration to the authenticated endpoint after login', async () => {
    let session: { token: string } | null = null;
    mockUseAuth.mockImplementation(() => ({ session }));
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PushNotificationProvider>child</PushNotificationProvider>
      );
    });
    await flushEffects();
    apiRequestMock.mockClear();

    session = { token: 'member-session' };
    await act(async () => {
      tree.update(<PushNotificationProvider>child</PushNotificationProvider>);
    });
    await flushEffects();

    expect(apiRequestMock).toHaveBeenCalledWith('/v1/me/push-devices', {
      method: 'POST',
      token: 'member-session',
      body: expect.objectContaining({ token: 'ExpoPushToken[test]' }),
    });
    tree.unmount();
  });

  it('does not request a token or backend registration when permission is denied', async () => {
    getPermissionsMock.mockResolvedValue({
      ...grantedPermission,
      status: 'denied',
      granted: false,
      canAskAgain: false,
    } as unknown as Notifications.NotificationPermissionsStatus);
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PushNotificationProvider>child</PushNotificationProvider>
      );
    });
    await flushEffects();

    expect(getExpoPushTokenMock).not.toHaveBeenCalled();
    expect(apiRequestMock).not.toHaveBeenCalled();
    tree.unmount();
  });

  it('requests permission on first launch when the OS reports denied but askable', async () => {
    getPermissionsMock.mockResolvedValue({
      ...grantedPermission,
      status: 'denied',
      granted: false,
      canAskAgain: true,
    } as unknown as Notifications.NotificationPermissionsStatus);
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PushNotificationProvider>child</PushNotificationProvider>
      );
    });
    await flushEffects();

    expect(requestPermissionsMock).toHaveBeenCalledTimes(1);
    expect(getExpoPushTokenMock).toHaveBeenCalledWith({
      projectId: originalProjectId,
    });
    expect(apiRequestMock).toHaveBeenCalledWith('/v1/devices', {
      method: 'POST',
      body: expect.objectContaining({ token: 'ExpoPushToken[test]' }),
    });
    tree.unmount();
  });

  it('skips registration when the runtime is not a physical device', async () => {
    mockDeviceState.isDevice = false;
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PushNotificationProvider>child</PushNotificationProvider>
      );
    });
    await flushEffects();

    expect(getExpoPushTokenMock).not.toHaveBeenCalled();
    expect(apiRequestMock).not.toHaveBeenCalled();
    tree.unmount();
  });

  it('skips registration when the Expo project ID is missing', async () => {
    if (constantsModule.expoConfig?.extra?.eas) {
      delete constantsModule.expoConfig.extra.eas.projectId;
    }
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PushNotificationProvider>child</PushNotificationProvider>
      );
    });
    await flushEffects();

    expect(getExpoPushTokenMock).not.toHaveBeenCalled();
    expect(apiRequestMock).not.toHaveBeenCalled();
    tree.unmount();
  });

  it('logs token generation failures without calling the backend', async () => {
    // Token acquisition retries with a backoff; make the delays resolve
    // instantly so the failure path completes within the test.
    const timeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation(((cb: () => void) => {
        cb();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout);
    getExpoPushTokenMock.mockRejectedValue(new Error('native token failed'));
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PushNotificationProvider>child</PushNotificationProvider>
      );
    });
    await flushEffects();

    expect(apiRequestMock).not.toHaveBeenCalled();
    expect(getExpoPushTokenMock.mock.calls.length).toBeGreaterThan(1);
    expect(console.error).toHaveBeenCalledWith(
      '[push] registration_failed',
      expect.objectContaining({
        stage: 'expo_token',
        message: 'native token failed',
      })
    );
    timeoutSpy.mockRestore();
    tree.unmount();
  });

  it('logs backend registration failures with safe API details', async () => {
    const { APIError } = jest.requireMock('../api/client') as {
      APIError: new (status: number, code: string) => Error;
    };
    apiRequestMock.mockRejectedValue(new APIError(503, 'request_failed'));
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PushNotificationProvider>child</PushNotificationProvider>
      );
    });
    await flushEffects();

    expect(console.error).toHaveBeenCalledWith(
      '[push] registration_failed',
      expect.objectContaining({
        stage: 'backend_registration',
        errorType: 'APIError',
        status: 503,
        code: 'request_failed',
      })
    );
    tree.unmount();
  });

  it('does not recursively register when native token listeners fire in flight', async () => {
    getExpoPushTokenMock.mockImplementation(async () => {
      mockPushTokenListener.callback?.();
      return { type: 'expo', data: 'ExpoPushToken[test]' };
    });
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <PushNotificationProvider>child</PushNotificationProvider>
      );
    });
    await flushEffects();

    expect(getExpoPushTokenMock).toHaveBeenCalledTimes(1);
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledWith(
      '[push] registration_skipped',
      { reason: 'registration_in_flight' }
    );
    tree.unmount();
  });
});
