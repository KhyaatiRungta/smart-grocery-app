/**
 * Thin fetch wrapper. The base URL comes from EXPO_PUBLIC_API_URL (see .env.example).
 * On a physical phone, point it at your machine's LAN address, not localhost.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8100').replace(/\/$/, '');

let getToken: () => string | null = () => null;

export function setTokenProvider(provider: () => string | null) {
  getToken = provider;
}

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(messageFrom(detail, status));
    this.status = status;
    this.detail = detail;
  }
}

function messageFrom(detail: unknown, status: number): string {
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && 'message' in detail && typeof (detail as { message: unknown }).message === 'string') {
    return (detail as { message: string }).message;
  }
  if (Array.isArray(detail) && detail[0] && typeof detail[0].msg === 'string') return detail[0].msg;
  return `Request failed (${status})`;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  idempotencyKey?: string;
  auth?: boolean;
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, idempotencyKey, auth = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Can’t reach the Smart Grocer server. Check your connection and try again.');
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(response.status, json?.detail ?? null);
  }
  return json as T;
}

/** Keys that are unique per checkout attempt; reused on retries of the same attempt. */
export function newIdempotencyKey(): string {
  return `chk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
