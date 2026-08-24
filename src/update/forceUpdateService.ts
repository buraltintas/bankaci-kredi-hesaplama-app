import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  parseForceUpdateConfig,
  requiresAndroidForceUpdate,
  type AndroidUpdatePolicy,
} from './forceUpdateConfig';

const CONFIG_URL =
  'https://raw.githubusercontent.com/buraltintas/bankaci-kredi-hesaplama-app/main/force-update.json';
const CACHE_KEY = 'bankaci.force-update.v1';
const REQUEST_TIMEOUT_MS = 5000;

export type AndroidUpdateRequirement = {
  currentVersionCode: number;
  policy: AndroidUpdatePolicy;
  isRequired: boolean;
};

const readCurrentAndroidVersionCode = (): number | null => {
  const versionCode = Constants.platform?.android?.versionCode;

  return typeof versionCode === 'number' && Number.isInteger(versionCode)
    ? versionCode
    : null;
};

const loadCachedPolicy = async (): Promise<AndroidUpdatePolicy | null> => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    const parsed = cached ? parseForceUpdateConfig(JSON.parse(cached)) : null;

    return parsed?.android ?? null;
  } catch {
    return null;
  }
};

const loadRemotePolicy = async (): Promise<AndroidUpdatePolicy | null> => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${CONFIG_URL}?t=${Date.now()}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const parsed = parseForceUpdateConfig(await response.json());

    if (!parsed) {
      return null;
    }

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(parsed)).catch(
      () => undefined
    );

    return parsed.android;
  } catch {
    return null;
  } finally {
    globalThis.clearTimeout(timeout);
  }
};

export const getAndroidUpdateRequirement = async (): Promise<
  AndroidUpdateRequirement | null
> => {
  if (Platform.OS !== 'android') {
    return null;
  }

  const currentVersionCode = readCurrentAndroidVersionCode();

  if (currentVersionCode === null) {
    return null;
  }

  const remotePolicy = await loadRemotePolicy();
  const policy = remotePolicy ?? (await loadCachedPolicy());

  if (!policy) {
    return null;
  }

  return {
    currentVersionCode,
    policy,
    isRequired: requiresAndroidForceUpdate(currentVersionCode, policy),
  };
};
