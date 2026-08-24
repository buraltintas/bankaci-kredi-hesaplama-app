export type AndroidUpdatePolicy = {
  enabled: boolean;
  minimumVersionCode: number;
  latestVersionCode: number;
  storeUrl: string;
  message: string;
};

export type ForceUpdateConfig = {
  android: AndroidUpdatePolicy;
};

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

export const parseForceUpdateConfig = (
  value: unknown
): ForceUpdateConfig | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const android = (value as { android?: unknown }).android;

  if (!android || typeof android !== 'object') {
    return null;
  }

  const candidate = android as Record<string, unknown>;

  if (
    typeof candidate.enabled !== 'boolean' ||
    !isPositiveInteger(candidate.minimumVersionCode) ||
    !isPositiveInteger(candidate.latestVersionCode) ||
    candidate.latestVersionCode < candidate.minimumVersionCode ||
    typeof candidate.storeUrl !== 'string' ||
    !candidate.storeUrl.startsWith('https://') ||
    typeof candidate.message !== 'string' ||
    candidate.message.trim().length === 0
  ) {
    return null;
  }

  return {
    android: {
      enabled: candidate.enabled,
      minimumVersionCode: candidate.minimumVersionCode,
      latestVersionCode: candidate.latestVersionCode,
      storeUrl: candidate.storeUrl,
      message: candidate.message,
    },
  };
};

export const requiresAndroidForceUpdate = (
  currentVersionCode: number,
  policy: AndroidUpdatePolicy
): boolean => {
  return policy.enabled && currentVersionCode < policy.minimumVersionCode;
};
