import type { WorkoutDto, WorkoutItemPlan, WorkoutSetDto } from '../../../shared/contract';

// The guided workout as a finite state machine. The screen never decides "what comes next" itself:
// it renders the state and sends events.
//
//   set ──logged──► rest ──restDone──► set ... ──logged (last set)──► done
//    │                 └──extendRest
//    ├──adjustWeight / adjustReps (stays in set)
//    └──skipExercise ──► set of the next exercise (or done)

export type Phase = 'set' | 'rest' | 'done';

export interface Cursor {
  itemIndex: number;
  setNo: number;
}

export interface Flow {
  workout: WorkoutDto;
  phase: Phase;
  /** The set being done (phase "set") or coming up after the rest (phase "rest"). */
  cursor: Cursor;
  restEndsAt: number | null;
  /** Values that "Seti tamamladım" will log; start from the plan, keep the member's adjustments. */
  weightKg: number | null;
  reps: number;
  /** Sets logged in this workout, keyed by `${programItemId}:${setNo}`. */
  logged: Record<string, WorkoutSetDto>;
  /** The set logged last, so its effort (RPE) can be added during the rest. */
  lastLogged: WorkoutSetDto | null;
}

export type FlowEvent =
  | { type: 'logged'; set: WorkoutSetDto; now: number }
  | { type: 'restDone' }
  | { type: 'extendRest'; ms: number; now: number }
  | { type: 'adjustWeight'; delta: number }
  | { type: 'adjustReps'; delta: number }
  | { type: 'skipExercise' }
  | { type: 'rated'; set: WorkoutSetDto };

const key = (programItemId: number, setNo: number) => `${programItemId}:${setNo}`;

export function weightStep(plan: WorkoutItemPlan): number {
  return plan.item.exercise.equipment === 'Dumbbell' ? 1 : 2.5;
}

/** First set, at or after `from`, that has not been logged yet. */
function nextOpen(workout: WorkoutDto, logged: Record<string, WorkoutSetDto>, from: Cursor): Cursor | null {
  for (let itemIndex = from.itemIndex; itemIndex < workout.items.length; itemIndex++) {
    const plan = workout.items[itemIndex];
    if (!plan) continue;
    const firstSet = itemIndex === from.itemIndex ? from.setNo : 1;
    for (let setNo = firstSet; setNo <= plan.item.targetSets; setNo++) {
      if (!logged[key(plan.item.id, setNo)]) return { itemIndex, setNo };
    }
  }
  return null;
}

/** Defaults for a set: the weight already used in this exercise today, else the suggestion; reps at the top of the range. */
function draftFor(workout: WorkoutDto, logged: Record<string, WorkoutSetDto>, cursor: Cursor): { weightKg: number | null; reps: number } {
  const plan = workout.items[cursor.itemIndex];
  if (!plan) return { weightKg: null, reps: 0 };
  const earlier = Object.values(logged)
    .filter((set) => set.programItemId === plan.item.id && set.setNo < cursor.setNo)
    .sort((a, b) => b.setNo - a.setNo)[0];
  return {
    weightKg: plan.item.exercise.isBodyweight ? null : (earlier?.weightKg ?? plan.suggestion.weightKg ?? 0),
    reps: plan.item.repMax,
  };
}

function enterSet(flow: Flow, cursor: Cursor | null, logged: Record<string, WorkoutSetDto>): Flow {
  if (!cursor) return { ...flow, logged, phase: 'done', restEndsAt: null };
  return { ...flow, logged, phase: 'set', cursor, restEndsAt: null, ...draftFor(flow.workout, logged, cursor) };
}

export function initFlow(workout: WorkoutDto): Flow {
  const logged: Record<string, WorkoutSetDto> = {};
  for (const plan of workout.items) for (const set of plan.doneSets) logged[key(set.programItemId, set.setNo)] = set;
  const base: Flow = { workout, phase: 'set', cursor: { itemIndex: 0, setNo: 1 }, restEndsAt: null, weightKg: null, reps: 0, logged, lastLogged: null };
  return enterSet(base, nextOpen(workout, logged, { itemIndex: 0, setNo: 1 }), logged);
}

export function flowReducer(flow: Flow, event: FlowEvent): Flow {
  switch (event.type) {
    case 'logged': {
      if (flow.phase !== 'set') return flow;
      const logged = { ...flow.logged, [key(event.set.programItemId, event.set.setNo)]: event.set };
      const next = nextOpen(flow.workout, logged, flow.cursor);
      if (!next) return { ...flow, logged, lastLogged: event.set, phase: 'done', restEndsAt: null };
      const restSec = flow.workout.items[flow.cursor.itemIndex]?.item.restSec ?? 90;
      return { ...flow, logged, lastLogged: event.set, phase: 'rest', cursor: next, restEndsAt: event.now + restSec * 1000, ...draftFor(flow.workout, logged, next) };
    }
    case 'restDone':
      return flow.phase === 'rest' ? { ...flow, phase: 'set', restEndsAt: null } : flow;
    case 'extendRest':
      return flow.phase === 'rest' && flow.restEndsAt !== null ? { ...flow, restEndsAt: Math.max(flow.restEndsAt, event.now) + event.ms } : flow;
    case 'adjustWeight': {
      const plan = flow.workout.items[flow.cursor.itemIndex];
      if (flow.phase !== 'set' || flow.weightKg === null || !plan) return flow;
      return { ...flow, weightKg: Math.max(0, Math.round((flow.weightKg + event.delta * weightStep(plan)) * 4) / 4) };
    }
    case 'adjustReps':
      return flow.phase === 'set' ? { ...flow, reps: Math.min(100, Math.max(0, flow.reps + event.delta)) } : flow;
    case 'skipExercise': {
      if (flow.phase === 'done') return flow;
      return enterSet(flow, nextOpen(flow.workout, flow.logged, { itemIndex: flow.cursor.itemIndex + 1, setNo: 1 }), flow.logged);
    }
    case 'rated': {
      const logged = { ...flow.logged, [key(event.set.programItemId, event.set.setNo)]: event.set };
      return { ...flow, logged, lastLogged: event.set };
    }
  }
}

export function progressOf(flow: Flow): { done: number; total: number } {
  const total = flow.workout.items.reduce((sum, plan) => sum + plan.item.targetSets, 0);
  return { done: Math.min(total, Object.keys(flow.logged).length), total };
}
