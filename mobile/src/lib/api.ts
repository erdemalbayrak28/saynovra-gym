import type {
  Enrollment,
  ExerciseProgressResponse,
  LogSetRequest,
  MeResponse,
  MemberLoginResponse,
  MyTrainingResponse,
  Problem,
  ProgramDetail,
  ProgramSummary,
  ProgressResponse,
  WorkoutDto,
  WorkoutSetDto,
  WorkoutSummary,
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
  return (res.status === 204 ? null : await res.json()) as T;
}

const post = <T>(path: string, token: string, body?: unknown) => request<T>(path, { method: 'POST', token, body });

export const api = {
  login: (phone: string, password: string) =>
    request<MemberLoginResponse>('/auth/member/login', { method: 'POST', body: { phone, password } }),
  me: (token: string) => request<MeResponse>('/me', { token }),

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
};
