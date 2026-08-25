const rawApiURL = process.env.EXPO_PUBLIC_BANKACI_API_URL?.trim() ?? '';

export const apiBaseURL = rawApiURL.replace(/\/+$/, '');

export const isAPIConfigured = (): boolean => apiBaseURL.length > 0;
