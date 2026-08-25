import { apiBaseURL, isAPIConfigured } from './config';

export class APIError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string
  ) {
    super(code);
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  token?: string | null;
  body?: unknown;
  formData?: FormData;
};

export const apiRequest = async <T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> => {
  if (!isAPIConfigured()) {
    throw new APIError(0, 'api_not_configured');
  }

  const { token, body, formData, headers: rawHeaders, ...requestInit } = options;
  const headers = new Headers(rawHeaders);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body !== undefined) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${apiBaseURL}${path}`, {
      ...requestInit,
      headers,
      body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  } catch {
    throw new APIError(0, 'network_error');
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new APIError(response.status, payload?.error ?? 'request_failed');
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};
