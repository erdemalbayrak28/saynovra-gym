import type {
  ActivationCodeResponse,
  CheckinDto,
  CreateMemberRequest,
  CreateMemberResponse,
  FloorEvent,
  GateScanResponse,
  MemberDetail,
  MemberListItem,
  PlanDto,
  Problem,
  ReceptionSummary,
  SellMembershipRequest,
  StaffLoginResponse,
  StaffSummary,
} from '../../../shared/contract';
import { API_URL } from './config';

const TIMEOUT_MS = 8000;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string;
}

async function request<T>(path: string, { method = 'GET', body, token }: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(0, 'Sunucuya ulaşılamıyor. Sunucu açık mı?');
  }
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as Partial<Problem> | null;
    throw new ApiError(res.status, problem?.detail ?? problem?.title ?? `Beklenmeyen hata (${res.status})`);
  }
  return (await res.json()) as T;
}

export const api = {
  staffLogin: (pin: string) => request<StaffLoginResponse>('/auth/staff/login', { method: 'POST', body: { pin } }),
  scan: (token: string, code: string) => request<GateScanResponse>('/gate/scan', { method: 'POST', body: { code }, token }),
  checkins: (token: string, limit = 30) => request<CheckinDto[]>(`/staff/checkins?limit=${limit}`, { token }),
  summary: (token: string) => request<StaffSummary>('/staff/summary', { token }),
  floor: (token: string) => request<FloorEvent[]>('/staff/floor', { token }),

  plans: (token: string) => request<PlanDto[]>('/staff/plans', { token }),
  receptionSummary: (token: string) => request<ReceptionSummary>('/staff/reception/summary', { token }),
  searchMembers: (token: string, query: string) => request<MemberListItem[]>(`/staff/members?q=${encodeURIComponent(query)}`, { token }),
  expiringMembers: (token: string) => request<MemberListItem[]>('/staff/members/expiring', { token }),
  member: (token: string, id: number) => request<MemberDetail>(`/staff/members/${id}`, { token }),
  sell: (token: string, memberId: number, body: SellMembershipRequest) =>
    request<MemberDetail>(`/staff/members/${memberId}/memberships`, { method: 'POST', body, token }),
  createMember: (token: string, body: CreateMemberRequest) => request<CreateMemberResponse>('/staff/members', { method: 'POST', body, token }),
  issueActivation: (token: string, memberId: number) =>
    request<ActivationCodeResponse>(`/staff/members/${memberId}/activation`, { method: 'POST', body: {}, token }),
  membershipAction: (token: string, membershipId: number, action: 'freeze' | 'unfreeze' | 'cancel') =>
    request<MemberDetail>(`/staff/memberships/${membershipId}/${action}`, { method: 'POST', token }),
};
