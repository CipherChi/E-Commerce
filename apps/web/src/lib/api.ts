const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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
  const token =
    typeof window === 'undefined' ? null : sessionStorage.getItem('staywise.accessToken');
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
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
