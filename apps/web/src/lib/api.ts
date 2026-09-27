const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token =
    typeof window === 'undefined' ? null : sessionStorage.getItem('staywise.accessToken');
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(typeof data.message === 'string' ? data.message : 'Request failed');
  return data as T;
}
