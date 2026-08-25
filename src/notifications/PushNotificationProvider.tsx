import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import { apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { navigationRef } from '../navigation/navigationRef';
import { setStoredExpoPushToken } from './pushTokenStorage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushStatus = 'checking' | 'disabled' | 'denied' | 'enabled' | 'unavailable';

type PushContextValue = {
  status: PushStatus;
  enableNotifications: () => Promise<boolean>;
};

const PushContext = createContext<PushContextValue>({
  status: 'checking',
  enableNotifications: async () => false,
});

const projectId =
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

const permissionAllowsNotifications = (
  permission: Notifications.NotificationPermissionsStatus
) =>
  permission.granted ||
  permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

const openNotification = (response: Notifications.NotificationResponse) => {
  const data = response.notification.request.content.data;
  if (data?.type !== 'feed_comment') return;
  const navigate = () => {
    if (navigationRef.isReady()) navigationRef.navigate('Feed');
  };
  navigate();
  setTimeout(navigate, 600);
};

export const PushNotificationProvider = ({ children }: PropsWithChildren) => {
  const { session } = useAuth();
  const [status, setStatus] = useState<PushStatus>('checking');

  const ensureAndroidChannel = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('social', {
      name: 'Topluluk bildirimleri',
      description: 'Gönderi ve yorum etkileşimleri',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200],
      lightColor: '#0B5CAD',
    });
  }, []);

  const register = useCallback(async () => {
    if (!session || !projectId || Platform.OS === 'web' || !Device.isDevice) {
      return false;
    }
    try {
      await ensureAndroidChannel();
      const result = await Notifications.getExpoPushTokenAsync({ projectId });
      await apiRequest<void>('/v1/me/push-devices', {
        method: 'POST',
        token: session.token,
        body: {
          token: result.data,
          platform: Platform.OS,
          deviceName: Device.deviceName ?? Device.modelName ?? Platform.OS,
        },
      });
      await setStoredExpoPushToken(result.data);
      setStatus('enabled');
      return true;
    } catch {
      return false;
    }
  }, [ensureAndroidChannel, session]);

  const enableNotifications = useCallback(async () => {
    if (Platform.OS === 'web') {
      setStatus('unavailable');
      return false;
    }
    try {
      await ensureAndroidChannel();
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
      if (session) void register();
      return true;
    } catch {
      setStatus('unavailable');
      return false;
    }
  }, [ensureAndroidChannel, register, session]);

  useEffect(() => {
    let active = true;
    if (Platform.OS === 'web') {
      setStatus('unavailable');
      return undefined;
    }
    void Notifications.getPermissionsAsync()
      .then((permission) => {
        if (!active) return;
        if (permissionAllowsNotifications(permission)) {
          setStatus('enabled');
          if (session) void register();
          return true;
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
  }, [enableNotifications, register, session]);

  useEffect(() => {
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      openNotification
    );
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openNotification(response);
    });
    return () => responseSubscription.remove();
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    const tokenSubscription = Notifications.addPushTokenListener(() => {
      void register();
    });
    return () => tokenSubscription.remove();
  }, [register, session]);

  useEffect(() => {
    if (!session || status !== 'enabled') return undefined;
    return NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void register();
    });
  }, [register, session, status]);

  const value = useMemo(
    () => ({ status, enableNotifications }),
    [enableNotifications, status]
  );
  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
};

export const usePushNotifications = () => useContext(PushContext);
