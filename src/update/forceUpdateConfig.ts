export type AndroidUpdatePolicy = {
  enabled: boolean;
  minimumVersionCode: number;
  latestVersionCode: number;
  storeUrl: string;
  message: string;
};

export type IosUpdatePolicy = {
  enabled: boolean;
  minimumBuildNumber: number;
  latestBuildNumber: number;
  minimumShortVersion?: string;
  latestShortVersion?: string;
  storeUrl: string;
  message: string;
};

export type ForceUpdateConfig = {
  android: AndroidUpdatePolicy | null;
  ios: IosUpdatePolicy | null;
};

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const isValidStoreUrl = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('https://');

const isValidMessage = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const parseAndroidPolicy = (value: unknown): AndroidUpdatePolicy | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.enabled !== 'boolean' ||
    !isPositiveInteger(candidate.minimumVersionCode) ||
    !isPositiveInteger(candidate.latestVersionCode) ||
    candidate.latestVersionCode < candidate.minimumVersionCode ||
    !isValidStoreUrl(candidate.storeUrl) ||
    !isValidMessage(candidate.message)
  ) {
    return null;
  }

  return {
    enabled: candidate.enabled,
    minimumVersionCode: candidate.minimumVersionCode,
    latestVersionCode: candidate.latestVersionCode,
    storeUrl: candidate.storeUrl,
    message: candidate.message,
  };
};

const parseIosPolicy = (value: unknown): IosUpdatePolicy | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.enabled !== 'boolean' ||
    !isPositiveInteger(candidate.minimumBuildNumber) ||
    !isPositiveInteger(candidate.latestBuildNumber) ||
    candidate.latestBuildNumber < candidate.minimumBuildNumber ||
    !isValidStoreUrl(candidate.storeUrl) ||
    !isValidMessage(candidate.message) ||
    (candidate.minimumShortVersion !== undefined &&
      typeof candidate.minimumShortVersion !== 'string') ||
    (candidate.latestShortVersion !== undefined &&
      typeof candidate.latestShortVersion !== 'string')
  ) {
    return null;
  }

  return {
    enabled: candidate.enabled,
    minimumBuildNumber: candidate.minimumBuildNumber,
    latestBuildNumber: candidate.latestBuildNumber,
    ...(typeof candidate.minimumShortVersion === 'string' &&
    candidate.minimumShortVersion.trim()
      ? { minimumShortVersion: candidate.minimumShortVersion.trim() }
      : {}),
    ...(typeof candidate.latestShortVersion === 'string' &&
    candidate.latestShortVersion.trim()
      ? { latestShortVersion: candidate.latestShortVersion.trim() }
      : {}),
    storeUrl: candidate.storeUrl,
    message: candidate.message,
  };
};

export const parseForceUpdateConfig = (
  value: unknown
): ForceUpdateConfig | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as { android?: unknown; ios?: unknown };
  const android = parseAndroidPolicy(candidate.android);
  const ios = parseIosPolicy(candidate.ios);

  return android || ios ? { android, ios } : null;
};

export const requiresAndroidForceUpdate = (
  currentVersionCode: number,
  policy: AndroidUpdatePolicy
): boolean => {
  return policy.enabled && currentVersionCode < policy.minimumVersionCode;
};

export const requiresIosForceUpdate = (
  currentBuildNumber: number,
  policy: IosUpdatePolicy
): boolean => {
  return policy.enabled && currentBuildNumber < policy.minimumBuildNumber;
};
