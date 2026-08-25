import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  parseForceUpdateConfig,
  requiresAndroidForceUpdate,
  requiresIosForceUpdate,
  type AndroidUpdatePolicy,
  type ForceUpdateConfig,
  type IosUpdatePolicy,
} from './forceUpdateConfig';

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_BANKACI_API_URL?.trim()
  .replace(/\/+$/, '');
const API_CONFIG_URL = configuredApiBaseUrl
  ? `${configuredApiBaseUrl}/v1/app/update-policy`
  : null;
const LEGACY_ANDROID_CONFIG_URL =
  'https://raw.githubusercontent.com/buraltintas/bankaci-kredi-hesaplama-app/main/force-update.json';
const CACHE_KEY = 'bankaci.force-update.v1';
const REQUEST_TIMEOUT_MS = 5000;

type AndroidUpdateRequirement = {
  platform: 'android';
  currentBuildNumber: number;
  policy: AndroidUpdatePolicy;
  isRequired: boolean;
};

type IosUpdateRequirement = {
  platform: 'ios';
  currentBuildNumber: number;
  policy: IosUpdatePolicy;
  isRequired: boolean;
};

export type AppUpdateRequirement =
  | AndroidUpdateRequirement
  | IosUpdateRequirement;

const readCurrentBuildNumber = (): number | null => {
  if (Platform.OS === 'android') {
    const versionCode = Constants.platform?.android?.versionCode;
    return typeof versionCode === 'number' && Number.isInteger(versionCode)
      ? versionCode
      : null;
  }

  if (Platform.OS === 'ios') {
    const buildNumber = Constants.platform?.ios?.buildNumber;
    const parsed = typeof buildNumber === 'string' ? Number(buildNumber) : NaN;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
};

const loadCachedConfig = async (): Promise<ForceUpdateConfig | null> => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    return cached ? parseForceUpdateConfig(JSON.parse(cached)) : null;
  } catch {
    return null;
  }
};

const fetchConfig = async (url: string): Promise<ForceUpdateConfig | null> => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${url}?t=${Date.now()}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return parseForceUpdateConfig(await response.json());
  } catch {
    return null;
  } finally {
    globalThis.clearTimeout(timeout);
  }
};

const loadRemoteConfig = async (): Promise<ForceUpdateConfig | null> => {
  const apiConfig = API_CONFIG_URL ? await fetchConfig(API_CONFIG_URL) : null;

  if (apiConfig) {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(apiConfig)).catch(
      () => undefined
    );
    return apiConfig;
  }

  if (Platform.OS !== 'android') {
    return null;
  }

  const legacyConfig = await fetchConfig(LEGACY_ANDROID_CONFIG_URL);
  if (legacyConfig) {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(legacyConfig)).catch(
      () => undefined
    );
  }
  return legacyConfig;
};

export const getAppUpdateRequirement = async (): Promise<AppUpdateRequirement | null> => {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return null;
  }

  const currentBuildNumber = readCurrentBuildNumber();
  if (currentBuildNumber === null) {
    return null;
  }

  const remoteConfig = await loadRemoteConfig();
  const config = remoteConfig ?? (await loadCachedConfig());
  if (!config) {
    return null;
  }

  if (Platform.OS === 'android' && config.android) {
    return {
      platform: 'android',
      currentBuildNumber,
      policy: config.android,
      isRequired: requiresAndroidForceUpdate(
        currentBuildNumber,
        config.android
      ),
    };
  }

  if (Platform.OS === 'ios' && config.ios) {
    return {
      platform: 'ios',
      currentBuildNumber,
      policy: config.ios,
      isRequired: requiresIosForceUpdate(currentBuildNumber, config.ios),
    };
  }

  return null;
};
