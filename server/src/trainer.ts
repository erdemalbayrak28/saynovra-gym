import type { MemberGoal, TrainerMemberDetail, TrainerMemberItem, TrainerWorkoutRow } from '../../shared/contract.ts';
import type { Db } from './db.ts';
import { effectiveStatus } from './domain/membership.ts';
import { HttpProblem } from './problem.ts';
import { currentMembership, initials, insideMemberIds } from './queries.ts';
import { localDate, mondayOf, startOfLocalDate } from './time.ts';
import { enroll, myTraining, progress } from './training.ts';

const RECENT_WORKOUTS = 6;
// SQLite sorts bytes; names are re-sorted in Turkish alphabetical order.
const turkish = new Intl.Collator('tr', { sensitivity: 'base' });

interface TraineeRow {
  id: number;
  full_name: string;
  goal: MemberGoal | null;
  height_cm: number | null;
  weight_kg: number | null;
  program_name: string | null;
  week_workouts: number;
  last_workout_at: string | null;
}

// Every query here is scoped by trainer_id: a trainer reads only the members assigned to them.
const TRAINEE_SELECT = `
  SELECT m.id, m.full_name, m.goal, m.height_cm, m.weight_kg,
    (SELECT p.name FROM member_programs mp JOIN programs p ON p.id = mp.program_id
      WHERE mp.member_id = m.id AND mp.ended_at IS NULL) AS program_name,
    (SELECT COUNT(*) FROM workouts w
      WHERE w.member_id = m.id AND w.status = 'done' AND w.finished_at >= :weekStart) AS week_workouts,
    (SELECT MAX(w.finished_at) FROM workouts w WHERE w.member_id = m.id AND w.status = 'done') AS last_workout_at
  FROM members m
  WHERE m.trainer_id = :trainerId AND m.role = 'member'`;

function toItem(db: Db, row: TraineeRow, today: string, inside: ReadonlySet<number>): TrainerMemberItem {
  const membership = currentMembership(db, row.id, today);
  return {
    id: row.id,
    fullName: row.full_name,
    initials: initials(row.full_name),
    isInside: inside.has(row.id),
    membershipStatus: membership ? effectiveStatus(membership.status, membership.ends_on, today) : null,
    programName: row.program_name,
    weekWorkouts: row.week_workouts,
    lastWorkoutAt: row.last_workout_at,
  };
}

/** The trainer's members: those in the gym first, then by name. */
export function listTrainees(db: Db, trainerId: number, now: Date, timeZone: string): TrainerMemberItem[] {
  const today = localDate(now, timeZone);
  const weekStart = startOfLocalDate(mondayOf(today), timeZone);
  const rows = db.prepare(TRAINEE_SELECT).all({ trainerId, weekStart }) as unknown as TraineeRow[];
  const inside = insideMemberIds(db, now);
  return rows
    .map((row) => toItem(db, row, today, inside))
    .sort((a, b) => Number(b.isInside) - Number(a.isInside) || turkish.compare(a.fullName, b.fullName));
}

function loadTrainee(db: Db, trainerId: number, memberId: number, weekStart: string): TraineeRow {
  const row = db.prepare(`${TRAINEE_SELECT} AND m.id = :memberId`).get({ trainerId, weekStart, memberId }) as TraineeRow | undefined;
  // Someone else's member and a member who does not exist look the same from outside.
  if (!row) throw new HttpProblem(404, 'Üye bulunamadı', 'Bu üye sana atanmış değil');
  return row;
}

export function traineeDetail(db: Db, trainerId: number, memberId: number, now: Date, timeZone: string): TrainerMemberDetail {
  const today = localDate(now, timeZone);
  const row = loadTrainee(db, trainerId, memberId, startOfLocalDate(mondayOf(today), timeZone));
  const training = myTraining(db, memberId, now, timeZone);
  const recent = db
    .prepare(
      `SELECT w.id, w.finished_at, d.name AS day_name, COUNT(s.id) AS sets, COALESCE(SUM(COALESCE(s.weight_kg, 0) * s.reps), 0) AS volume_kg
       FROM workouts w
       JOIN program_days d ON d.id = w.program_day_id
       LEFT JOIN workout_sets s ON s.workout_id = w.id
       WHERE w.member_id = ? AND w.status = 'done'
       GROUP BY w.id ORDER BY w.finished_at DESC LIMIT ?`,
    )
    .all(memberId, RECENT_WORKOUTS) as unknown as { id: number; finished_at: string; day_name: string; sets: number; volume_kg: number }[];
  const recentWorkouts: TrainerWorkoutRow[] = recent.map((w) => ({
    id: w.id,
    finishedAt: w.finished_at,
    dayName: w.day_name,
    sets: w.sets,
    volumeKg: Math.round(w.volume_kg),
  }));

  return {
    member: toItem(db, row, today, insideMemberIds(db, now)),
    goal: row.goal,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    enrollment: training.enrollment,
    nextDay: training.nextDay,
    activeWorkout: training.activeWorkoutId !== null,
    progress: progress(db, memberId, now, timeZone),
    recentWorkouts,
  };
}

/** A trainer starts a programme for one of their members; the enrolment records who chose it. */
export function assignProgram(db: Db, trainerId: number, memberId: number, programId: number, now: Date, timeZone: string): TrainerMemberDetail {
  loadTrainee(db, trainerId, memberId, startOfLocalDate(mondayOf(localDate(now, timeZone)), timeZone));
  enroll(db, memberId, programId, now, trainerId);
  return traineeDetail(db, trainerId, memberId, now, timeZone);
}
