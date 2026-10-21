const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function refreshAccessToken(): Promise<string | null> {
  if (accessToken) return Promise.resolve(accessToken);
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${apiUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Session expired');
        const result = (await response.json()) as { accessToken?: string };
        if (typeof result.accessToken !== 'string' || !result.accessToken) {
          throw new Error('Invalid session response');
        }
        accessToken = result.accessToken;
        return accessToken;
      } catch {
        accessToken = null;
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export type ApiRequestMetric = {
  endpoint: string;
  method: string;
  durationMs: number;
  outcome: 'success' | 'error';
  status: number | null;
  requestId?: string;
};

type ApiRequestMonitor = (metric: ApiRequestMetric) => void;
let apiRequestMonitor: ApiRequestMonitor | null = null;

export function setApiRequestMonitor(monitor: ApiRequestMonitor | null) {
  apiRequestMonitor = monitor;
}

function reportApiRequest(metric: ApiRequestMetric) {
  try {
    apiRequestMonitor?.(metric);
  } catch {
    // Monitoring must not change the outcome of an API request.
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const endpoint = new URL(path, apiUrl).pathname;
  const startedAt = Date.now();
  let response: Response | undefined;
  let requestId: string | undefined;
  let reported = false;
  const send = (token: string | null) =>
    fetch(`${apiUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  try {
    response = await send(accessToken);
    if (
      response.status === 401 &&
      !['/auth/login', '/auth/register', '/auth/refresh'].includes(path)
    ) {
      accessToken = null;
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) response = await send(refreshedToken);
    }
    requestId = response.headers.get('x-request-id') ?? undefined;
    const data = await response.json().catch(() => ({}));
    reportApiRequest({
      endpoint,
      method,
      durationMs: Date.now() - startedAt,
      outcome: response.ok ? 'success' : 'error',
      status: response.status,
      ...(requestId ? { requestId } : {}),
    });
    reported = true;
    if (!response.ok)
      throw new Error(typeof data.message === 'string' ? data.message : 'Request failed');
    return data as T;
  } catch (error) {
    if (!reported) {
      reportApiRequest({
        endpoint,
        method,
        durationMs: Date.now() - startedAt,
        outcome: 'error',
        status: response?.status ?? null,
        ...(requestId ? { requestId } : {}),
      });
    }
    throw error;
  }
}
