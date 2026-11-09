// Four weeks of finished workouts for the demo member, shaped so that the next session shows
// every kind of suggestion: increase, "one more good session", hold and deload.
import type { Db } from './db.ts';
import { INCREMENT_KG } from './domain/progression.ts';
import { addDays, mondayOf } from './time.ts';

type Trend = 'ready' | 'progressing' | 'hold' | 'struggling';

/** Working weight (kg) and trend per exercise for the demo member; bodyweight moves are omitted. */
const DEMO_PLAN: Record<string, [number, Trend]> = {
  'incline-db-press': [30, 'ready'],
  'lat-pulldown': [75, 'ready'],
  'barbell-row': [80, 'hold'],
  'cable-fly': [15, 'progressing'],
  'triceps-pushdown': [27.5, 'struggling'],
  squat: [100, 'progressing'],
  rdl: [90, 'ready'],
  'leg-extension': [50, 'hold'],
  'calf-raise': [70, 'ready'],
  ohp: [50, 'hold'],
  'seated-cable-row': [70, 'ready'],
  'lateral-raise': [10, 'progressing'],
  'biceps-curl': [14, 'hold'],
  'face-pull': [20, 'ready'],
  deadlift: [140, 'progressing'],
  'leg-press': [180, 'ready'],
  'walking-lunge': [20, 'hold'],
  'leg-curl': [45, 'hold'],
  'hip-thrust': [100, 'ready'],
};

const WEEKS = 4;
/** Monday, Tuesday, Thursday, Friday. */
const WEEKDAY_OFFSETS = [0, 1, 3, 4] as const;
/** 19:00 in Istanbul (UTC+3 all year). */
const START_HOUR_UTC = 16;
const MINUTES_PER_SET = 3;

interface ItemRow {
  id: number;
  day_index: number;
  day_id: number;
  exercise_id: number;
  slug: string;
  target_sets: number;
  rep_min: number;
  rep_max: number;
  is_lower_body: number;
  is_bodyweight: number;
}

function weightFor(trend: Trend, working: number, increment: number, session: number): number {
  const lighter = Math.max(0, working - increment);
  const steps = trend === 'ready' || trend === 'progressing' ? [lighter, lighter, working, working] : [lighter, working, working, working];
  return steps[session] ?? working;
}

/** Reps per set for session 0..3 (oldest to newest). */
function repsFor(trend: Trend, sets: number, min: number, top: number, session: number): number[] {
  const all = (reps: number) => Array.from({ length: sets }, () => reps);
  const tapering = (start: number) => Array.from({ length: sets }, (_, i) => Math.max(min, start - i));
  const failing = Array.from({ length: sets }, (_, i) => Math.max(1, min - i));
  switch (trend) {
    case 'ready':
      return session === 0 ? [...all(top).slice(0, -1), top - 1] : all(top);
    case 'progressing':
      return session === 1 || session === 3 ? all(top) : tapering(top);
    case 'hold':
      return tapering(top);
    case 'struggling':
      return session >= 2 ? failing : tapering(top - 1);
  }
}

const RPE_BY_SESSION: Record<Trend, number[]> = {
  ready: [8.5, 8, 7.5, 7.5],
  progressing: [8.5, 8, 9, 8],
  hold: [8.5, 8.5, 8.5, 8.5],
  struggling: [8.5, 9, 9.5, 9.5],
};

export function seedTrainingHistory(db: Db, input: { memberId: number; programId: number; today: string }): number {
  const items = db
    .prepare(
      `SELECT i.id, d.day_index, d.id AS day_id, e.id AS exercise_id, e.slug, i.target_sets, i.rep_min, i.rep_max,
         e.is_lower_body, e.is_bodyweight
       FROM program_items i JOIN program_days d ON d.id = i.program_day_id JOIN exercises e ON e.id = i.exercise_id
       WHERE d.program_id = ? ORDER BY d.day_index, i.sort_order`,
    )
    .all(input.programId) as unknown as ItemRow[];
  const dayCount = Math.max(...items.map((item) => item.day_index));

  const firstMonday = addDays(mondayOf(input.today), -7 * WEEKS);
  const enrolledAt = `${addDays(firstMonday, -1)}T${String(START_HOUR_UTC).padStart(2, '0')}:00:00.000Z`;
  const enrollment = db
    .prepare(
      'INSERT INTO member_programs (member_id, program_id, next_day_index, started_at, created_at, modified_at) VALUES (?, ?, 1, ?, ?, ?)',
    )
    .run(input.memberId, input.programId, enrolledAt, enrolledAt, enrolledAt);
  const enrollmentId = Number(enrollment.lastInsertRowid);

  const insertWorkout = db.prepare(
    "INSERT INTO workouts (member_id, member_program_id, program_day_id, status, started_at, finished_at) VALUES (?, ?, ?, 'done', ?, ?)",
  );
  const insertSet = db.prepare(
    `INSERT INTO workout_sets (workout_id, program_item_id, exercise_id, set_no, weight_kg, reps, rpe, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let count = 0;
  for (let week = 0; week < WEEKS; week++) {
    for (let dayIndex = 1; dayIndex <= dayCount; dayIndex++) {
      const date = addDays(firstMonday, week * 7 + (WEEKDAY_OFFSETS[dayIndex - 1] ?? dayIndex - 1));
      const dayItems = items.filter((item) => item.day_index === dayIndex);
      const startedAt = new Date(`${date}T${String(START_HOUR_UTC).padStart(2, '0')}:05:00.000Z`);
      let minute = 0;
      const sets: [itemId: number, exerciseId: number, setNo: number, weight: number | null, reps: number, rpe: number | null, at: string][] = [];

      for (const item of dayItems) {
        const [working, trend] = DEMO_PLAN[item.slug] ?? [0, 'hold'];
        const increment = item.is_lower_body ? INCREMENT_KG.lower : INCREMENT_KG.upper;
        const reps = item.is_bodyweight
          ? repsFor(week === WEEKS - 1 ? 'ready' : 'hold', item.target_sets, item.rep_min, item.rep_max, week)
          : repsFor(trend, item.target_sets, item.rep_min, item.rep_max, week);
        reps.forEach((rep, i) => {
          minute += MINUTES_PER_SET;
          const at = new Date(startedAt.getTime() + minute * 60 * 1000).toISOString();
          const weight = item.is_bodyweight ? null : weightFor(trend, working, increment, week);
          sets.push([item.id, item.exercise_id, i + 1, weight, rep, item.is_bodyweight ? null : (RPE_BY_SESSION[trend][week] ?? null), at]);
        });
      }

      const finishedAt = new Date(startedAt.getTime() + (minute + 4) * 60 * 1000).toISOString();
      const dayId = dayItems[0]?.day_id;
      if (dayId === undefined) continue;
      const workout = insertWorkout.run(input.memberId, enrollmentId, dayId, startedAt.toISOString(), finishedAt);
      const workoutId = Number(workout.lastInsertRowid);
      for (const [itemId, exerciseId, setNo, weight, rep, rpe, at] of sets) {
        insertSet.run(workoutId, itemId, exerciseId, setNo, weight, rep, rpe, at, at);
      }
      count++;
    }
  }
  return count;
}
