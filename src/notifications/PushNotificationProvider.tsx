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
import { apiRequest } from '../api/client';
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
};

const PushContext = createContext<PushContextValue>({
  status: 'checking',
  enableNotifications: async () => false,
  preferences: DEFAULT_PREFERENCES,
  setPreference: async () => undefined,
});

const projectId =
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

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
  const [status, setStatus] = useState<PushStatus>('checking');
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const deviceTokenRef = useRef<string | null>(null);

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

  const register = useCallback(async () => {
    if (!projectId || Platform.OS === 'web' || !Device.isDevice) {
      return false;
    }
    try {
      await ensureAndroidChannels();
      const result = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = result.data;
      const payload = {
        token,
        platform: Platform.OS,
        deviceName: Device.deviceName ?? Device.modelName ?? Platform.OS,
      };
      // A signed-in device links to the account (so personal notifications can
      // reach it); a guest device registers for broadcasts only.
      const nextPreferences = session
        ? await apiRequest<NotificationPreferences>('/v1/me/push-devices', {
            method: 'POST',
            token: session.token,
            body: payload,
          })
        : await apiRequest<NotificationPreferences>('/v1/devices', {
            method: 'POST',
            body: payload,
          });
      await setStoredExpoPushToken(token);
      deviceTokenRef.current = token;
      setPreferences(nextPreferences);
      setStatus('enabled');
      return true;
    } catch {
      return false;
    }
  }, [ensureAndroidChannels, session]);

  const enableNotifications = useCallback(async () => {
    if (Platform.OS === 'web') {
      setStatus('unavailable');
      return false;
    }
    try {
      await ensureAndroidChannels();
      let permission = await Notifications.getPermissionsAsync();
      if (!permissionAllowsNotifications(permission)) {
        permission = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
      }
      if (!permissionAllowsNotifications(permission)) {
        setStatus('denied');
        return false;
      }
      setStatus('enabled');
      void register();
      return true;
    } catch {
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
        if (permissionAllowsNotifications(permission)) {
          setStatus('enabled');
          return register();
        }
        if (permission.status === 'undetermined') {
          return enableNotifications();
        }
        setStatus('denied');
        return false;
      })
      .catch(() => active && setStatus('unavailable'));
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
      void register();
    });
    return () => tokenSubscription.remove();
  }, [register]);

  useEffect(() => {
    if (status !== 'enabled') return undefined;
    return NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false)
        void register();
    });
  }, [register, status]);

  const value = useMemo(
    () => ({ status, enableNotifications, preferences, setPreference }),
    [enableNotifications, preferences, setPreference, status]
  );
  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
};

export const usePushNotifications = () => useContext(PushContext);
