import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { APIError, apiRequest } from '../api/client';
import type {
  CalculationEventInput,
  QueuedCalculationEvent,
} from './types';

const INSTALLATION_ID_KEY = 'bankaci.analytics-installation.v1';
const QUEUE_KEY = 'bankaci.analytics-queue.v1';
const MAX_QUEUE_SIZE = 100;

let flushPromise: Promise<void> | null = null;
let storageChain: Promise<void> = Promise.resolve();
let installationIDCache: string | null = null;

const withStorageLock = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = storageChain.then(operation, operation);
  storageChain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
};

const randomHex = (length: number): string => {
  let value = '';
  while (value.length < length) {
    value += Math.floor(Math.random() * 0x100000000)
      .toString(16)
      .padStart(8, '0');
  }
  return value.slice(0, length);
};

const createUUID = (): string =>
  `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${(
    8 + Math.floor(Math.random() * 4)
  ).toString(16)}${randomHex(3)}-${randomHex(12)}`;

const getInstallationID = async (): Promise<string> => {
  if (installationIDCache) return installationIDCache;
  const current = await SecureStore.getItemAsync(INSTALLATION_ID_KEY).catch(
    () => null
  );
  if (current) {
    installationIDCache = current;
    return current;
  }
  const created = `installation-${createUUID()}`;
  installationIDCache = created;
  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, created).catch(
    () => undefined
  );
  return created;
};

const readQueue = async (): Promise<QueuedCalculationEvent[]> => {
  const raw = await AsyncStorage.getItem(QUEUE_KEY).catch(() => null);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_QUEUE_SIZE) : [];
  } catch {
    return [];
  }
};

const writeQueue = (events: QueuedCalculationEvent[]): Promise<void> =>
  AsyncStorage.setItem(
    QUEUE_KEY,
    JSON.stringify(events.slice(-MAX_QUEUE_SIZE))
  );

export const isCalculationAnalyticsEnabled = async (): Promise<boolean> =>
  true;

export const flushCalculationAnalytics = async (): Promise<void> => {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    if (!(await isCalculationAnalyticsEnabled())) return;
    await withStorageLock(async () => {
      const queue = await readQueue();
      let sent = 0;
      for (const event of queue) {
        if (!(await isCalculationAnalyticsEnabled())) break;
        try {
          await apiRequest<void>('/v1/analytics/calculations', {
            method: 'POST',
            body: event,
          });
          sent += 1;
        } catch (error) {
          if (
            error instanceof APIError &&
            (error.status === 400 || error.status === 429)
          ) {
            sent += 1;
            continue;
          }
          break;
        }
      }
      if (sent > 0) await writeQueue(queue.slice(sent));
    });
  })().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
};

export const trackCalculation = async (
  input: CalculationEventInput
): Promise<void> => {
  if (!(await isCalculationAnalyticsEnabled())) return;
  const installationId = await getInstallationID();
  const event: QueuedCalculationEvent = {
    ...input,
    eventId: createUUID(),
    installationId,
    occurredAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version ?? 'unknown',
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  };
  await withStorageLock(async () => {
    const queue = await readQueue();
    await writeQueue([...queue, event]);
  });
  await flushCalculationAnalytics();
};
