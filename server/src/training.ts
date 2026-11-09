import type {
  Enrollment,
  ExerciseInfo,
  ExerciseProgressResponse,
  LogSetRequest,
  MyTrainingResponse,
  ProgramDayDto,
  ProgramDetail,
  ProgramGoal,
  ProgramItemDto,
  ProgramLevel,
  ProgramSummary,
  ProgressResponse,
  WorkoutDto,
  WorkoutRecord,
  WorkoutSetDto,
  WorkoutSummary,
} from '../../shared/contract.ts';
import { transaction, type Db } from './db.ts';
import { describeSession, suggestNext, type Session } from './domain/progression.ts';
import { HttpProblem } from './problem.ts';
import { addDays, localDate, mondayOf, startOfLocalDate } from './time.ts';

/** Average working time per set, used with the rest time to estimate a session's length. */
const SECONDS_PER_SET = 45;
/** A member may log a couple of sets beyond the plan (e.g. a back-off set). */
const EXTRA_SETS_ALLOWED = 2;
const PROGRESS_WEEKS = 6;

// ---------------------------------------------------------------------------
// Rows and mapping
// ---------------------------------------------------------------------------

interface ProgramRow {
  id: number;
  name: string;
  goal: ProgramGoal;
  level: ProgramLevel;
  days_per_week: number;
  weeks: number;
  description: string;
  day_count: number;
}

interface DayRow {
  id: number;
  program_id: number;
  day_index: number;
  name: string;
  focus: string;
}

interface ItemRow {
  id: number;
  program_day_id: number;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  rest_sec: number;
  start_weight_kg: number | null;
  exercise_id: number;
  exercise_name: string;
  muscle_group: string;
  equipment: string;
  is_lower_body: number;
  is_bodyweight: number;
  cue: string;
}

interface EnrollmentRow {
  id: number;
  program_id: number;
  next_day_index: number;
  started_at: string;
}

interface WorkoutRow {
  id: number;
  member_id: number;
  member_program_id: number;
  program_day_id: number;
  status: 'active' | 'done';
  started_at: string;
}

interface SetRow {
  program_item_id: number;
  set_no: number;
  weight_kg: number | null;
  reps: number;
  rpe: number | null;
}

const PROGRAM_SELECT = `
  SELECT p.id, p.name, p.goal, p.level, p.days_per_week, p.weeks, p.description,
    (SELECT COUNT(*) FROM program_days d WHERE d.program_id = p.id) AS day_count
  FROM programs p`;

const ITEM_SELECT = `
  SELECT i.id, i.program_day_id, i.target_sets, i.rep_min, i.rep_max, i.rest_sec, i.start_weight_kg,
    e.id AS exercise_id, e.name AS exercise_name, e.muscle_group, e.equipment, e.is_lower_body, e.is_bodyweight, e.cue
  FROM program_items i JOIN exercises e ON e.id = i.exercise_id`;

function toSummary(row: ProgramRow): ProgramSummary {
  return {
    id: row.id,
    name: row.name,
    goal: row.goal,
    level: row.level,
    daysPerWeek: row.days_per_week,
    weeks: row.weeks,
    description: row.description,
    dayCount: row.day_count,
  };
}

function toExercise(row: ItemRow): ExerciseInfo {
  return {
    id: row.exercise_id,
    name: row.exercise_name,
    muscleGroup: row.muscle_group,
    equipment: row.equipment,
    isBodyweight: row.is_bodyweight === 1,
    cue: row.cue,
  };
}

function toItem(row: ItemRow): ProgramItemDto {
  return { id: row.id, exercise: toExercise(row), targetSets: row.target_sets, repMin: row.rep_min, repMax: row.rep_max, restSec: row.rest_sec };
}

function toSetDto(row: SetRow): WorkoutSetDto {
  return { programItemId: row.program_item_id, setNo: row.set_no, weightKg: row.weight_kg, reps: row.reps, rpe: row.rpe };
}

export function estimateMinutes(items: { targetSets: number; restSec: number }[]): number {
  const seconds = items.reduce((sum, item) => sum + item.targetSets * (SECONDS_PER_SET + item.restSec), 0);
  return Math.max(5, Math.round(seconds / 60 / 5) * 5);
}

// ---------------------------------------------------------------------------
// Programme library
// ---------------------------------------------------------------------------

export function listPrograms(db: Db): ProgramSummary[] {
  return (db.prepare(`${PROGRAM_SELECT} ORDER BY p.id`).all() as unknown as ProgramRow[]).map(toSummary);
}

function findProgram(db: Db, id: number): ProgramRow | undefined {
  return db.prepare(`${PROGRAM_SELECT} WHERE p.id = ?`).get(id) as ProgramRow | undefined;
}

function itemsOfDay(db: Db, dayId: number): ItemRow[] {
  return db.prepare(`${ITEM_SELECT} WHERE i.program_day_id = ? ORDER BY i.sort_order`).all(dayId) as unknown as ItemRow[];
}

function toDay(db: Db, day: DayRow): ProgramDayDto {
  const items = itemsOfDay(db, day.id).map(toItem);
  return { id: day.id, dayIndex: day.day_index, name: day.name, focus: day.focus, items, estimatedMinutes: estimateMinutes(items) };
}

export function getProgramDetail(db: Db, id: number): ProgramDetail {
  const program = findProgram(db, id);
  if (!program) throw new HttpProblem(404, 'Program bulunamadı');
  const days = db.prepare('SELECT * FROM program_days WHERE program_id = ? ORDER BY day_index').all(id) as unknown as DayRow[];
  return { ...toSummary(program), days: days.map((day) => toDay(db, day)) };
}

function dayByIndex(db: Db, programId: number, dayIndex: number): DayRow {
  const day =
    (db.prepare('SELECT * FROM program_days WHERE program_id = ? AND day_index = ?').get(programId, dayIndex) as DayRow | undefined) ??
    (db.prepare('SELECT * FROM program_days WHERE program_id = ? ORDER BY day_index LIMIT 1').get(programId) as DayRow | undefined);
  if (!day) throw new Error(`Program ${programId} has no days`);
  return day;
}

// ---------------------------------------------------------------------------
// Enrolment
// ---------------------------------------------------------------------------

function activeEnrollment(db: Db, memberId: number): EnrollmentRow | undefined {
  return db
    .prepare('SELECT id, program_id, next_day_index, started_at FROM member_programs WHERE member_id = ? AND ended_at IS NULL')
    .get(memberId) as EnrollmentRow | undefined;
}

function activeWorkout(db: Db, memberId: number): WorkoutRow | undefined {
  return db.prepare("SELECT * FROM workouts WHERE member_id = ? AND status = 'active'").get(memberId) as WorkoutRow | undefined;
}

function completedWorkouts(db: Db, enrollmentId: number): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM workouts WHERE member_program_id = ? AND status = 'done'").get(enrollmentId) as { n: number };
  return row.n;
}

function toEnrollment(db: Db, row: EnrollmentRow): Enrollment {
  const program = findProgram(db, row.program_id);
  if (!program) throw new Error(`Enrollment ${row.id} points at missing program ${row.program_id}`);
  return { id: row.id, program: toSummary(program), startedAt: row.started_at, completedWorkouts: completedWorkouts(db, row.id) };
}

export function enroll(db: Db, memberId: number, programId: number, now: Date): Enrollment {
  return transaction(db, () => {
    if (!findProgram(db, programId)) throw new HttpProblem(404, 'Program bulunamadı');
    if (activeWorkout(db, memberId)) {
      throw new HttpProblem(409, 'Program değiştirilemedi', 'Önce devam eden antrenmanı bitir ya da iptal et');
    }
    const stamp = now.toISOString();
    db.prepare('UPDATE member_programs SET ended_at = ?, modified_at = ? WHERE member_id = ? AND ended_at IS NULL').run(stamp, stamp, memberId);
    db.prepare(
      'INSERT INTO member_programs (member_id, program_id, next_day_index, started_at, created_at, modified_at) VALUES (?, ?, 1, ?, ?, ?)',
    ).run(memberId, programId, stamp, stamp, stamp);
    const row = activeEnrollment(db, memberId);
    if (!row) throw new Error('Enrollment vanished right after insert');
    return toEnrollment(db, row);
  });
}

export function myTraining(db: Db, memberId: number, now: Date, timeZone: string): MyTrainingResponse {
  const row = activeEnrollment(db, memberId);
  const weekStart = startOfLocalDate(mondayOf(localDate(now, timeZone)), timeZone);
  const { n: weekWorkouts } = db
    .prepare("SELECT COUNT(*) AS n FROM workouts WHERE member_id = ? AND status = 'done' AND finished_at >= ?")
    .get(memberId, weekStart) as { n: number };
  return {
    enrollment: row ? toEnrollment(db, row) : null,
    nextDay: row ? toDay(db, dayByIndex(db, row.program_id, row.next_day_index)) : null,
    activeWorkoutId: activeWorkout(db, memberId)?.id ?? null,
    weekWorkouts,
  };
}

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

/** Most recent finished sessions of an exercise for a member, newest first. */
export function exerciseHistory(db: Db, memberId: number, exerciseId: number, limit: number): Session[] {
  const rows = db
    .prepare(
      `SELECT ws.workout_id, ws.weight_kg, ws.reps, ws.rpe
       FROM workout_sets ws JOIN workouts w ON w.id = ws.workout_id
       WHERE w.member_id = ? AND ws.exercise_id = ? AND w.status = 'done'
       ORDER BY w.finished_at DESC, ws.set_no ASC`,
    )
    .all(memberId, exerciseId) as unknown as { workout_id: number; weight_kg: number | null; reps: number; rpe: number | null }[];
  const sessions: Session[] = [];
  let currentId: number | null = null;
  for (const row of rows) {
    if (row.workout_id !== currentId) {
      if (sessions.length === limit) break;
      sessions.push([]);
      currentId = row.workout_id;
    }
    sessions[sessions.length - 1]?.push({ weightKg: row.weight_kg, reps: row.reps, rpe: row.rpe });
  }
  return sessions;
}

function ownedWorkout(db: Db, memberId: number, workoutId: number): WorkoutRow {
  const workout = db.prepare('SELECT * FROM workouts WHERE id = ? AND member_id = ?').get(workoutId, memberId) as WorkoutRow | undefined;
  if (!workout) throw new HttpProblem(404, 'Antrenman bulunamadı');
  if (workout.status !== 'active') throw new HttpProblem(409, 'Antrenman bitmiş', 'Bu antrenman zaten tamamlandı');
  return workout;
}

function buildWorkout(db: Db, memberId: number, workout: WorkoutRow): WorkoutDto {
  const day = db.prepare('SELECT * FROM program_days WHERE id = ?').get(workout.program_day_id) as DayRow | undefined;
  const program = day ? findProgram(db, day.program_id) : undefined;
  if (!day || !program) throw new Error(`Workout ${workout.id} points at a missing programme day`);
  const sets = db
    .prepare('SELECT program_item_id, set_no, weight_kg, reps, rpe FROM workout_sets WHERE workout_id = ? ORDER BY set_no')
    .all(workout.id) as unknown as SetRow[];

  return {
    id: workout.id,
    startedAt: workout.started_at,
    programName: program.name,
    dayIndex: day.day_index,
    dayCount: program.day_count,
    dayName: day.name,
    items: itemsOfDay(db, day.id).map((row) => {
      const history = exerciseHistory(db, memberId, row.exercise_id, 2);
      return {
        item: toItem(row),
        suggestion: suggestNext(
          {
            targetSets: row.target_sets,
            repMin: row.rep_min,
            repMax: row.rep_max,
            isLowerBody: row.is_lower_body === 1,
            isBodyweight: row.is_bodyweight === 1,
            startWeightKg: row.start_weight_kg,
          },
          history,
        ),
        lastTime: history[0] ? describeSession(history[0]) : null,
        doneSets: sets.filter((set) => set.program_item_id === row.id).map(toSetDto),
      };
    }),
  };
}

/** Resumes the workout in progress, or starts the programme's next day. */
export function startWorkout(db: Db, memberId: number, now: Date): WorkoutDto {
  const workout = transaction(db, () => {
    const existing = activeWorkout(db, memberId);
    if (existing) return existing;
    const enrollment = activeEnrollment(db, memberId);
    if (!enrollment) throw new HttpProblem(409, 'Program seçilmedi', 'Antrenmana başlamak için önce bir program seç');
    const day = dayByIndex(db, enrollment.program_id, enrollment.next_day_index);
    const result = db
      .prepare("INSERT INTO workouts (member_id, member_program_id, program_day_id, status, started_at) VALUES (?, ?, ?, 'active', ?)")
      .run(memberId, enrollment.id, day.id, now.toISOString());
    return db.prepare('SELECT * FROM workouts WHERE id = ?').get(Number(result.lastInsertRowid)) as unknown as WorkoutRow;
  });
  return buildWorkout(db, memberId, workout);
}

export function logSet(db: Db, memberId: number, workoutId: number, input: LogSetRequest, now: Date): WorkoutSetDto {
  return transaction(db, () => {
    const workout = ownedWorkout(db, memberId, workoutId);
    const item = db
      .prepare(`${ITEM_SELECT} WHERE i.id = ? AND i.program_day_id = ?`)
      .get(input.programItemId, workout.program_day_id) as ItemRow | undefined;
    if (!item) throw new HttpProblem(400, 'Geçersiz hareket', 'Bu hareket bugünkü antrenmanda yok');
    if (input.setNo > item.target_sets + EXTRA_SETS_ALLOWED) {
      throw new HttpProblem(400, 'Geçersiz set', `Bu harekette en fazla ${item.target_sets + EXTRA_SETS_ALLOWED} set kaydedilebilir`);
    }
    const bodyweight = item.is_bodyweight === 1;
    if (bodyweight !== (input.weightKg === null)) {
      throw new HttpProblem(400, 'Geçersiz ağırlık', bodyweight ? 'Vücut ağırlığı hareketinde ağırlık girilmez' : 'Ağırlık girilmeli');
    }
    const stamp = now.toISOString();
    db.prepare(
      `INSERT INTO workout_sets (workout_id, program_item_id, exercise_id, set_no, weight_kg, reps, rpe, created_at, modified_at)
       VALUES (:workoutId, :itemId, :exerciseId, :setNo, :weightKg, :reps, :rpe, :stamp, :stamp)
       ON CONFLICT (workout_id, program_item_id, set_no)
       DO UPDATE SET weight_kg = excluded.weight_kg, reps = excluded.reps, rpe = excluded.rpe, modified_at = excluded.modified_at`,
    ).run({
      workoutId,
      itemId: item.id,
      exerciseId: item.exercise_id,
      setNo: input.setNo,
      weightKg: input.weightKg,
      reps: input.reps,
      rpe: input.rpe,
      stamp,
    });
    return { programItemId: item.id, setNo: input.setNo, weightKg: input.weightKg, reps: input.reps, rpe: input.rpe };
  });
}

export function finishWorkout(db: Db, memberId: number, workoutId: number, now: Date): WorkoutSummary {
  return transaction(db, () => {
    const workout = ownedWorkout(db, memberId, workoutId);
    const sets = db
      .prepare(
        `SELECT ws.exercise_id, e.name, ws.weight_kg, ws.reps
         FROM workout_sets ws JOIN exercises e ON e.id = ws.exercise_id WHERE ws.workout_id = ?`,
      )
      .all(workoutId) as unknown as { exercise_id: number; name: string; weight_kg: number | null; reps: number }[];
    if (sets.length === 0) {
      throw new HttpProblem(409, 'Kaydedilecek set yok', 'Hiç set tamamlanmadı; istersen antrenmanı iptal edebilirsin');
    }

    const records: WorkoutRecord[] = [];
    const bestToday = new Map<number, { name: string; weight: number }>();
    for (const set of sets) {
      if (set.weight_kg === null) continue;
      const best = bestToday.get(set.exercise_id);
      if (!best || set.weight_kg > best.weight) bestToday.set(set.exercise_id, { name: set.name, weight: set.weight_kg });
    }
    for (const [exerciseId, best] of bestToday) {
      const { previous } = db
        .prepare(
          `SELECT MAX(ws.weight_kg) AS previous FROM workout_sets ws JOIN workouts w ON w.id = ws.workout_id
           WHERE w.member_id = ? AND w.status = 'done' AND ws.exercise_id = ?`,
        )
        .get(memberId, exerciseId) as { previous: number | null };
      if (previous !== null && best.weight > previous) records.push({ exerciseName: best.name, weightKg: best.weight });
    }

    const stamp = now.toISOString();
    db.prepare("UPDATE workouts SET status = 'done', finished_at = ? WHERE id = ?").run(stamp, workoutId);

    const enrollment = db.prepare('SELECT id, program_id, next_day_index, started_at FROM member_programs WHERE id = ?').get(workout.member_program_id) as unknown as EnrollmentRow;
    const program = findProgram(db, enrollment.program_id);
    const dayCount = program?.day_count ?? 1;
    const doneDay = db.prepare('SELECT day_index FROM program_days WHERE id = ?').get(workout.program_day_id) as { day_index: number };
    const nextIndex = (doneDay.day_index % dayCount) + 1;
    db.prepare('UPDATE member_programs SET next_day_index = ?, modified_at = ? WHERE id = ?').run(nextIndex, stamp, enrollment.id);

    return {
      workoutId,
      durationMinutes: Math.max(1, Math.round((now.getTime() - Date.parse(workout.started_at)) / 60000)),
      totalSets: sets.length,
      totalReps: sets.reduce((sum, set) => sum + set.reps, 0),
      volumeKg: Math.round(sets.reduce((sum, set) => sum + (set.weight_kg ?? 0) * set.reps, 0)),
      records,
      nextDayName: dayByIndex(db, enrollment.program_id, nextIndex).name,
    };
  });
}

export function discardWorkout(db: Db, memberId: number, workoutId: number): void {
  transaction(db, () => {
    ownedWorkout(db, memberId, workoutId);
    db.prepare('DELETE FROM workout_sets WHERE workout_id = ?').run(workoutId);
    db.prepare('DELETE FROM workouts WHERE id = ?').run(workoutId);
  });
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export function progress(db: Db, memberId: number, now: Date, timeZone: string): ProgressResponse {
  const exercises = (
    db
      .prepare(
        `SELECT e.id, e.name, COUNT(DISTINCT w.id) AS sessions, MAX(ws.weight_kg) AS best
         FROM workout_sets ws JOIN workouts w ON w.id = ws.workout_id JOIN exercises e ON e.id = ws.exercise_id
         WHERE w.member_id = ? AND w.status = 'done'
         GROUP BY e.id ORDER BY sessions DESC, best IS NULL, e.name`,
      )
      .all(memberId) as unknown as { id: number; name: string; sessions: number; best: number | null }[]
  ).map((row) => ({ exerciseId: row.id, name: row.name, sessions: row.sessions, bestWeightKg: row.best }));

  const thisMonday = mondayOf(localDate(now, timeZone));
  const mondays = Array.from({ length: PROGRESS_WEEKS }, (_, i) => addDays(thisMonday, (i - PROGRESS_WEEKS + 1) * 7));
  const firstMonday = mondays[0] ?? thisMonday;
  const workouts = db
    .prepare(
      `SELECT w.id, w.finished_at, COALESCE(SUM(COALESCE(ws.weight_kg, 0) * ws.reps), 0) AS volume
       FROM workouts w LEFT JOIN workout_sets ws ON ws.workout_id = w.id
       WHERE w.member_id = ? AND w.status = 'done' AND w.finished_at >= ?
       GROUP BY w.id`,
    )
    .all(memberId, startOfLocalDate(firstMonday, timeZone)) as unknown as { finished_at: string; volume: number }[];

  const weeks = mondays.map((weekStart) => ({ weekStart, workouts: 0, volumeKg: 0 }));
  for (const workout of workouts) {
    const week = weeks.find((w) => w.weekStart === mondayOf(localDate(new Date(workout.finished_at), timeZone)));
    if (!week) continue;
    week.workouts += 1;
    week.volumeKg += Math.round(workout.volume);
  }
  return { exercises, weeks };
}

export function exerciseProgress(db: Db, memberId: number, exerciseId: number, timeZone: string): ExerciseProgressResponse {
  const exercise = db
    .prepare(
      `SELECT id AS exercise_id, name AS exercise_name, muscle_group, equipment, is_bodyweight, cue FROM exercises WHERE id = ?`,
    )
    .get(exerciseId) as ItemRow | undefined;
  if (!exercise) throw new HttpProblem(404, 'Hareket bulunamadı');
  const rows = db
    .prepare(
      `SELECT w.finished_at, MAX(ws.weight_kg) AS top_weight, MAX(ws.reps) AS top_reps,
         SUM(COALESCE(ws.weight_kg, 0) * ws.reps) AS volume
       FROM workout_sets ws JOIN workouts w ON w.id = ws.workout_id
       WHERE w.member_id = ? AND w.status = 'done' AND ws.exercise_id = ?
       GROUP BY w.id ORDER BY w.finished_at`,
    )
    .all(memberId, exerciseId) as unknown as { finished_at: string; top_weight: number | null; top_reps: number; volume: number }[];
  return {
    exercise: toExercise(exercise),
    points: rows.map((row) => ({
      date: localDate(new Date(row.finished_at), timeZone),
      topWeightKg: row.top_weight,
      topReps: row.top_reps,
      volumeKg: Math.round(row.volume),
    })),
  };
}
