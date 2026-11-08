import type { MeResponse, MemberLoginResponse, Problem } from '../../../shared/contract';
import { API_URL } from './config';

const TIMEOUT_MS = 8000;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown; token?: string } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'Sunucuya ulaşılamıyor. Telefon ve bilgisayar aynı Wi-Fi ağında mı?');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as Partial<Problem> | null;
    throw new ApiError(res.status, problem?.detail ?? problem?.title ?? `Beklenmeyen hata (${res.status})`);
  }
  return (await res.json()) as T;
}

export const api = {
  login: (phone: string, password: string) =>
    request<MemberLoginResponse>('/auth/member/login', { method: 'POST', body: { phone, password } }),
  me: (token: string) => request<MeResponse>('/me', { token }),
};
