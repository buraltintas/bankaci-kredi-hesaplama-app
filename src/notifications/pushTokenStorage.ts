import * as SecureStore from 'expo-secure-store';

const PUSH_TOKEN_KEY = 'bankaci.expo-push-token.v1';

export const getStoredExpoPushToken = () =>
  SecureStore.getItemAsync(PUSH_TOKEN_KEY).catch(() => null);

export const setStoredExpoPushToken = (token: string) =>
  SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
