import type {
  ChatResponse,
  Enrollment,
  ExerciseProgressResponse,
  LogSetRequest,
  MeResponse,
  MemberLoginResponse,
  MemberProfile,
  MyConsentsResponse,
  MyTrainingResponse,
  OccupancyResponse,
  OpenPostRequest,
  Problem,
  ProgramDetail,
  ProgramSummary,
  ProgressResponse,
  QrKeyResponse,
  RadarResponse,
  SpotMessageDto,
  SpotRequestDto,
  SpotterPostDto,
  TrainerMemberDetail,
  TrainerMemberItem,
  UpdateProfileRequest,
  WorkoutDto,
  WorkoutSetDto,
  WorkoutSummary,
} from '../../../shared/contract';
import { apiUrl } from './config';

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
    res = await fetch(apiUrl() + path, {
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
  return (res.status === 204 ? null : await res.json()) as T;
}

const post = <T>(path: string, token: string, body?: unknown) => request<T>(path, { method: 'POST', token, body });

export const api = {
  login: (phone: string, password: string) =>
    request<MemberLoginResponse>('/auth/member/login', { method: 'POST', body: { phone, password } }),
  activate: (phone: string, code: string, password: string) =>
    request<MemberLoginResponse>('/auth/member/activate', { method: 'POST', body: { phone, code, password } }),
  me: (token: string) => request<MeResponse>('/me', { token }),
  consents: (token: string) => request<MyConsentsResponse>('/me/consents', { token }),
  updateProfile: (token: string, body: UpdateProfileRequest) => post<MemberProfile>('/me/profile', token, body),

  trainees: (token: string) => request<TrainerMemberItem[]>('/trainer/members', { token }),
  trainee: (token: string, memberId: number) => request<TrainerMemberDetail>(`/trainer/members/${memberId}`, { token }),
  assignProgram: (token: string, memberId: number, programId: number) =>
    post<TrainerMemberDetail>(`/trainer/members/${memberId}/program`, token, { programId }),
  qrKey: (token: string) => request<QrKeyResponse>('/me/qr-key', { token }),

  programs: (token: string) => request<ProgramSummary[]>('/programs', { token }),
  program: (token: string, id: number) => request<ProgramDetail>(`/programs/${id}`, { token }),
  training: (token: string) => request<MyTrainingResponse>('/me/training', { token }),
  enroll: (token: string, programId: number) => post<Enrollment>('/me/program', token, { programId }),

  startWorkout: (token: string) => post<WorkoutDto>('/me/workouts', token),
  logSet: (token: string, workoutId: number, set: LogSetRequest) => post<WorkoutSetDto>(`/me/workouts/${workoutId}/sets`, token, set),
  finishWorkout: (token: string, workoutId: number) => post<WorkoutSummary>(`/me/workouts/${workoutId}/finish`, token),
  discardWorkout: (token: string, workoutId: number) => post<null>(`/me/workouts/${workoutId}/discard`, token),

  progress: (token: string) => request<ProgressResponse>('/me/progress', { token }),
  exerciseProgress: (token: string, exerciseId: number) => request<ExerciseProgressResponse>(`/me/progress/${exerciseId}`, { token }),

  occupancy: (token: string) => request<OccupancyResponse>('/gym/occupancy', { token }),
  radar: (token: string) => request<RadarResponse>('/me/radar', { token }),
  openPost: (token: string, input: OpenPostRequest) => post<SpotterPostDto>('/me/radar/post', token, input),
  closePost: (token: string) => post<null>('/me/radar/post/close', token),
  sendSpotRequest: (token: string, postId: number) => post<SpotRequestDto>('/me/spot-requests', token, { postId }),
  actOnSpotRequest: (token: string, requestId: number, action: 'accept' | 'decline' | 'cancel') =>
    post<SpotRequestDto>(`/me/spot-requests/${requestId}/${action}`, token),
  chat: (token: string, requestId: number) => request<ChatResponse>(`/me/spot-requests/${requestId}/chat`, { token }),
  sendMessage: (token: string, requestId: number, body: string) => post<SpotMessageDto>(`/me/spot-requests/${requestId}/messages`, token, { body }),
};
