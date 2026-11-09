import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import type {
  Enrollment,
  ExerciseProgressResponse,
  MyTrainingResponse,
  ProgramDetail,
  ProgramSummary,
  ProgressResponse,
  WorkoutDto,
  WorkoutSummary,
} from '../../shared/contract.ts';
import { createApp } from '../src/app.ts';
import { issueToken } from '../src/auth.ts';
import { seedCatalog } from '../src/catalog.ts';
import type { Config } from '../src/config.ts';
import { LiveHub } from '../src/live.ts';
import { TZ, addMember, testDb } from './helpers.ts';

const config: Config = {
  PORT: 0,
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  DB_PATH: ':memory:',
  GYM_CAPACITY: 85,
  GYM_TIMEZONE: TZ,
};

describe('training API', () => {
  const db = testDb();
  let clock = new Date('2026-11-09T16:00:00Z');
  const app = createApp({ db, config, live: new LiveHub(config.JWT_SECRET), now: () => clock });
  let auth: Record<string, string> = {};

  const get = async <T>(path: string) => {
    const res = await app.request(path, { headers: auth });
    return { status: res.status, body: (await res.json()) as T };
  };
  const post = async <T>(path: string, body?: unknown) => {
    const res = await app.request(path, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (res.status === 204 ? null : await res.json()) as T };
  };

  before(async () => {
    seedCatalog(db, clock);
    const member = addMember(db);
    auth = { Authorization: `Bearer ${await issueToken(config.JWT_SECRET, { sub: member.id, role: 'member' })}` };
  });

  it('lists the programme library with details', async () => {
    const list = await get<ProgramSummary[]>('/programs');
    assert.equal(list.status, 200);
    assert.ok(list.body.length >= 5);
    const detail = await get<ProgramDetail>(`/programs/${list.body[0]?.id}`);
    assert.equal(detail.body.days.length, detail.body.dayCount);
    assert.ok(detail.body.days.every((day) => day.items.length > 0 && day.estimatedMinutes > 0));
    assert.equal((await get('/programs/9999')).status, 404);
  });

  it('refuses to start a workout before a programme is chosen', async () => {
    const res = await post('/me/workouts');
    assert.equal(res.status, 409);
  });

  it('runs a whole programme day and moves on to the next one', async () => {
    const programs = await get<ProgramSummary[]>('/programs');
    const upperLower = programs.body.find((p) => p.name.startsWith('Hipertrofi'));
    assert.ok(upperLower);

    const enrolled = await post<Enrollment>('/me/program', { programId: upperLower.id });
    assert.equal(enrolled.status, 201);
    const training = await get<MyTrainingResponse>('/me/training');
    assert.equal(training.body.nextDay?.dayIndex, 1);

    const started = await post<WorkoutDto>('/me/workouts');
    assert.equal(started.status, 200);
    const workout = started.body;
    assert.equal(workout.dayIndex, 1);
    const first = workout.items[0];
    assert.ok(first);
    assert.equal(first.suggestion.kind, 'start');
    assert.equal(first.lastTime, null);

    // Starting again resumes the same workout.
    assert.equal((await post<WorkoutDto>('/me/workouts')).body.id, workout.id);
    // Switching programme mid-workout is refused.
    assert.equal((await post('/me/program', { programId: upperLower.id })).status, 409);

    for (const plan of workout.items) {
      for (let setNo = 1; setNo <= plan.item.targetSets; setNo++) {
        const res = await post(`/me/workouts/${workout.id}/sets`, {
          programItemId: plan.item.id,
          setNo,
          weightKg: plan.item.exercise.isBodyweight ? null : plan.suggestion.weightKg,
          reps: plan.item.repMax,
          rpe: 7.5,
        });
        assert.equal(res.status, 200);
      }
    }
    clock = new Date(clock.getTime() + 60 * 60 * 1000);
    const summary = await post<WorkoutSummary>(`/me/workouts/${workout.id}/finish`);
    assert.equal(summary.status, 200);
    assert.equal(summary.body.durationMinutes, 60);
    assert.ok(summary.body.volumeKg > 0);
    assert.equal(summary.body.records.length, 0);

    const after = await get<MyTrainingResponse>('/me/training');
    assert.equal(after.body.nextDay?.dayIndex, 2);
    assert.equal(after.body.enrollment?.completedWorkouts, 1);
    assert.equal(after.body.weekWorkouts, 1);
    assert.equal(after.body.activeWorkoutId, null);
    assert.equal((await post(`/me/workouts/${workout.id}/sets`, { programItemId: first.item.id, setNo: 1, weightKg: 20, reps: 10 })).status, 409);
  });

  it('validates what a set can be', async () => {
    const workout = (await post<WorkoutDto>('/me/workouts')).body;
    const weighted = workout.items.find((p) => !p.item.exercise.isBodyweight);
    const bodyweight = workout.items.find((p) => p.item.exercise.isBodyweight);
    assert.ok(weighted && bodyweight);
    const set = (body: Record<string, unknown>) => post(`/me/workouts/${workout.id}/sets`, { setNo: 1, reps: 8, rpe: null, ...body });

    assert.equal((await set({ programItemId: weighted.item.id, weightKg: null })).status, 400);
    assert.equal((await set({ programItemId: bodyweight.item.id, weightKg: 10 })).status, 400);
    assert.equal((await set({ programItemId: 999999, weightKg: 10 })).status, 400);
    assert.equal((await set({ programItemId: weighted.item.id, weightKg: 10, setNo: weighted.item.targetSets + 3 })).status, 400);
    assert.equal((await set({ programItemId: weighted.item.id, weightKg: 10.1 })).status, 400);

    // Logging the same set twice corrects it instead of adding a new one.
    await set({ programItemId: weighted.item.id, weightKg: 60 });
    await set({ programItemId: weighted.item.id, weightKg: 62.5 });
    const resumed = (await post<WorkoutDto>('/me/workouts')).body;
    const sets = resumed.items.find((p) => p.item.id === weighted.item.id)?.doneSets ?? [];
    assert.equal(sets.length, 1);
    assert.equal(sets[0]?.weightKg, 62.5);

    assert.equal((await post(`/me/workouts/${workout.id}/discard`)).status, 204);
    assert.equal((await get<MyTrainingResponse>('/me/training')).body.activeWorkoutId, null);
  });

  it('refuses to finish an empty workout', async () => {
    const workout = (await post<WorkoutDto>('/me/workouts')).body;
    assert.equal((await post(`/me/workouts/${workout.id}/finish`)).status, 409);
    await post(`/me/workouts/${workout.id}/discard`);
  });

  it('reports progress per exercise and per week', async () => {
    const overview = await get<ProgressResponse>('/me/progress');
    assert.equal(overview.body.weeks.length, 6);
    assert.equal(overview.body.weeks.at(-1)?.workouts, 1);
    const exercise = overview.body.exercises[0];
    assert.ok(exercise);
    const detail = await get<ExerciseProgressResponse>(`/me/progress/${exercise.exerciseId}`);
    assert.equal(detail.body.points.length, 1);
    assert.equal((await get('/me/progress/999999')).status, 404);
  });

  it('suggests more weight after two good sessions', async () => {
    // Two more Day 1 sessions at the suggested weight, every set at the top of the range.
    const programs = await get<ProgramSummary[]>('/programs');
    const upperLower = programs.body.find((p) => p.name.startsWith('Hipertrofi'));
    for (let round = 0; round < 2; round++) {
      await post('/me/program', { programId: upperLower?.id });
      const workout = (await post<WorkoutDto>('/me/workouts')).body;
      const plan = workout.items[0];
      assert.ok(plan);
      for (let setNo = 1; setNo <= plan.item.targetSets; setNo++) {
        await post(`/me/workouts/${workout.id}/sets`, { programItemId: plan.item.id, setNo, weightKg: 30, reps: plan.item.repMax, rpe: 7 });
      }
      clock = new Date(clock.getTime() + 24 * 60 * 60 * 1000);
      await post(`/me/workouts/${workout.id}/finish`);
    }
    await post('/me/program', { programId: upperLower?.id });
    const next = (await post<WorkoutDto>('/me/workouts')).body.items[0];
    assert.equal(next?.suggestion.kind, 'increase');
    assert.equal(next?.suggestion.weightKg, 32.5);
    assert.equal(next?.lastTime, '30 kg · 10, 10, 10, 10');
  });
});
