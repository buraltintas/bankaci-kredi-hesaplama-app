import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import { APIError, apiRequest } from '../api/client';
import type {
  NotificationCategory,
  NotificationPreferences,
} from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { navigationRef } from '../navigation/navigationRef';
import {
  getStoredExpoPushToken,
  setStoredExpoPushToken,
} from './pushTokenStorage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushStatus =
  | 'checking'
  | 'disabled'
  | 'denied'
  | 'enabled'
  | 'unavailable';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  requests: true,
  feed: true,
  announcements: true,
};

type PushContextValue = {
  status: PushStatus;
  enableNotifications: () => Promise<boolean>;
  preferences: NotificationPreferences;
  setPreference: (
    category: NotificationCategory,
    enabled: boolean
  ) => Promise<void>;
  // Temporary diagnostic: the reason the last token registration failed, so an
  // iOS device that silently never registers can surface the cause on screen.
  registrationError: string | null;
};

const PushContext = createContext<PushContextValue>({
  status: 'checking',
  enableNotifications: async () => false,
  preferences: DEFAULT_PREFERENCES,
  setPreference: async () => undefined,
  registrationError: null,
});

const getExpoProjectId = () =>
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

type RegistrationStage =
  | 'preflight'
  | 'android_channels'
  | 'expo_token'
  | 'backend_registration'
  | 'token_storage';

const pushDiagnostic = (
  event: string,
  details: Record<string, unknown> = {}
) => {
  console.info(`[push] ${event}`, details);
};

const pushDiagnosticError = (
  event: string,
  error: unknown,
  details: Record<string, unknown> = {}
) => {
  const safeError =
    error instanceof APIError
      ? { errorType: 'APIError', status: error.status, code: error.code }
      : error instanceof Error
        ? { errorType: error.name, message: error.message }
        : { errorType: typeof error };
  console.error(`[push] ${event}`, { ...details, ...safeError });
};

const permissionAllowsNotifications = (
  permission: Notifications.NotificationPermissionsStatus
) =>
  permission.granted ||
  permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

// Every feed-related notification opens the community tab. Personal request and
// admin announcements deliberately carry no target, so tapping just opens the
// app on the last screen.
const FEED_NOTIFICATION_TYPES = new Set([
  'feed_comment',
  'feed_like',
  'feed_digest',
]);

const openNotification = (response: Notifications.NotificationResponse) => {
  const type = response.notification.request.content.data?.type;
  if (typeof type !== 'string' || !FEED_NOTIFICATION_TYPES.has(type)) return;
  const navigate = () => {
    if (navigationRef.isReady()) navigationRef.navigate('Feed');
  };
  navigate();
  setTimeout(navigate, 600);
};

export const PushNotificationProvider = ({ children }: PropsWithChildren) => {
  const { session } = useAuth();
  const configuredProjectId = getExpoProjectId();
  const [status, setStatus] = useState<PushStatus>('checking');
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const deviceTokenRef = useRef<string | null>(null);
  const registrationInFlightRef = useRef(false);
  const [registrationError, setRegistrationError] = useState<string | null>(
    null
  );

  useEffect(() => {
    pushDiagnostic('provider_mounted', {
      platform: Platform.OS,
      isDevice: Device.isDevice,
      hasProjectId: Boolean(configuredProjectId),
    });
  }, [configuredProjectId]);

  const ensureAndroidChannels = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    // Channel ids must match the backend's ChannelID values.
    await Notifications.setNotificationChannelAsync('requests', {
      name: 'Talepler',
      description: 'Talep linkiniz açıldığında ve yeni başvuru geldiğinde',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250],
      lightColor: '#0B5CAD',
    });
    await Notifications.setNotificationChannelAsync('social', {
      name: 'Öğle Arası',
      description: 'Topluluk gönderileri ve etkileşimleri',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200],
      lightColor: '#0B5CAD',
    });
    await Notifications.setNotificationChannelAsync('announcements', {
      name: 'Duyurular',
      description: 'Bankacı ekibinden önemli duyurular',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200],
      lightColor: '#0B5CAD',
    });
  }, []);

  const register = useCallback(async (reason: string = 'manual') => {
    pushDiagnostic('registration_started', {
      platform: Platform.OS,
      reason,
      isDevice: Device.isDevice,
      hasProjectId: Boolean(configuredProjectId),
      authenticated: Boolean(session),
    });
    if (Platform.OS === 'web') {
      pushDiagnostic('registration_skipped', { reason: 'web' });
      return false;
    }
    if (!configuredProjectId) {
      pushDiagnostic('registration_skipped', { reason: 'missing_project_id' });
      setStatus('unavailable');
      return false;
    }
    if (!Device.isDevice) {
      pushDiagnostic('registration_skipped', { reason: 'not_physical_device' });
      setStatus('unavailable');
      return false;
    }
    if (registrationInFlightRef.current) {
      pushDiagnostic('registration_skipped', {
        reason: 'registration_in_flight',
      });
      return false;
    }
    registrationInFlightRef.current = true;
    let stage: RegistrationStage = 'preflight';
    try {
      stage = 'android_channels';
      await ensureAndroidChannels();
      pushDiagnostic('android_channels_ready', { platform: Platform.OS });
      stage = 'expo_token';
      const result = await Notifications.getExpoPushTokenAsync({
        projectId: configuredProjectId,
      });
      const token = result.data;
      pushDiagnostic('expo_token_created', {
        platform: Platform.OS,
        tokenPresent: token.length > 0,
      });
      const payload = {
        token,
        platform: Platform.OS,
        deviceName: Device.deviceName ?? Device.modelName ?? Platform.OS,
      };
      // A signed-in device links to the account (so personal notifications can
      // reach it); a guest device registers for broadcasts only.
      const endpoint = session ? '/v1/me/push-devices' : '/v1/devices';
      stage = 'backend_registration';
      pushDiagnostic('backend_registration_started', {
        endpoint,
        authenticated: Boolean(session),
      });
      const nextPreferences = session
        ? await apiRequest<NotificationPreferences>(endpoint, {
            method: 'POST',
            token: session.token,
            body: payload,
          })
        : await apiRequest<NotificationPreferences>(endpoint, {
            method: 'POST',
            body: payload,
          });
      pushDiagnostic('backend_registration_succeeded', { endpoint });
      stage = 'token_storage';
      await setStoredExpoPushToken(token);
      deviceTokenRef.current = token;
      setPreferences(nextPreferences);
      setStatus('enabled');
      setRegistrationError(null);
      return true;
    } catch (error: unknown) {
      pushDiagnosticError('registration_failed', error, {
        platform: Platform.OS,
        reason,
        stage,
        authenticated: Boolean(session),
      });
      const detail =
        error instanceof APIError
          ? `API ${error.status}${error.code ? ` ${error.code}` : ''}`
          : error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error);
      setRegistrationError(`${stage} — ${detail}`);
      return false;
    } finally {
      registrationInFlightRef.current = false;
    }
  }, [configuredProjectId, ensureAndroidChannels, session]);

  const enableNotifications = useCallback(async () => {
    if (Platform.OS === 'web') {
      setStatus('unavailable');
      return false;
    }
    try {
      await ensureAndroidChannels();
      let permission = await Notifications.getPermissionsAsync();
      pushDiagnostic('permission_checked', {
        platform: Platform.OS,
        status: permission.status,
        granted: permissionAllowsNotifications(permission),
      });
      if (!permissionAllowsNotifications(permission)) {
        permission = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        pushDiagnostic('permission_requested', {
          platform: Platform.OS,
          status: permission.status,
          granted: permissionAllowsNotifications(permission),
        });
      }
      if (!permissionAllowsNotifications(permission)) {
        setStatus('denied');
        return false;
      }
      setStatus('enabled');
      return await register('permission_enabled');
    } catch (error: unknown) {
      pushDiagnosticError('permission_flow_failed', error, {
        platform: Platform.OS,
      });
      setStatus('unavailable');
      return false;
    }
  }, [ensureAndroidChannels, register]);

  const setPreference = useCallback(
    async (category: NotificationCategory, enabled: boolean) => {
      const previous = preferences;
      const next = { ...preferences, [category]: enabled };
      setPreferences(next); // optimistic
      const token = deviceTokenRef.current ?? (await getStoredExpoPushToken());
      if (!token) {
        setPreferences(previous);
        return;
      }
      try {
        const saved = await apiRequest<NotificationPreferences>(
          '/v1/devices/preferences',
          { method: 'PATCH', body: { token, ...next } }
        );
        setPreferences(saved);
      } catch {
        setPreferences(previous); // roll back a change the server never took
      }
    },
    [preferences]
  );

  useEffect(() => {
    let active = true;
    if (Platform.OS === 'web') {
      setStatus('unavailable');
      return undefined;
    }
    void Notifications.getPermissionsAsync()
      .then((permission) => {
        if (!active) return undefined;
        pushDiagnostic('initial_permission_resolved', {
          platform: Platform.OS,
          status: permission.status,
          granted: permissionAllowsNotifications(permission),
        });
        if (permissionAllowsNotifications(permission)) {
          setStatus('enabled');
          return register('existing_permission');
        }
        if (permission.canAskAgain) {
          return enableNotifications();
        }
        setStatus('denied');
        return false;
      })
      .catch((error: unknown) => {
        pushDiagnosticError('initial_permission_failed', error, {
          platform: Platform.OS,
        });
        if (active) setStatus('unavailable');
      });
    return () => {
      active = false;
    };
  }, [enableNotifications, register]);

  useEffect(() => {
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(openNotification);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openNotification(response);
    });
    return () => responseSubscription.remove();
  }, []);

  useEffect(() => {
    const tokenSubscription = Notifications.addPushTokenListener(() => {
      void register('native_token_changed');
    });
    return () => tokenSubscription.remove();
  }, [register]);

  useEffect(() => {
    if (status !== 'enabled') return undefined;
    return NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false)
        void register('network_available');
    });
  }, [register, status]);

  const value = useMemo(
    () => ({
      status,
      enableNotifications,
      preferences,
      setPreference,
      registrationError,
    }),
    [enableNotifications, preferences, registrationError, setPreference, status]
  );
  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
};

export const usePushNotifications = () => useContext(PushContext);
