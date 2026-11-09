import type { Suggestion } from '../../../shared/contract.ts';

// Double progression, decided from the member's own logged sets (PLAN.md section 4):
// - two sessions in a row at the same weight with every set at the top of the rep range, and an
//   average RPE of 8 or less where it was recorded: add weight (upper body +2.5 kg, lower +5 kg);
// - two sessions in a row with a set below the bottom of the range: drop about 10 %;
// - otherwise keep the weight and say what unlocks the next step.

export const INCREMENT_KG = { upper: 2.5, lower: 5 } as const;
export const WEIGHT_STEP_KG = 2.5;
export const MAX_RPE_FOR_INCREASE = 8;
export const DELOAD_FACTOR = 0.9;

export interface ProgressionTarget {
  targetSets: number;
  repMin: number;
  repMax: number;
  isLowerBody: boolean;
  isBodyweight: boolean;
  startWeightKg: number | null;
}

export interface LoggedSet {
  weightKg: number | null;
  reps: number;
  rpe: number | null;
}

/** Sets of one finished session of this exercise. `history[0]` is the most recent session. */
export type Session = LoggedSet[];

export function formatKg(kg: number): string {
  return Number.isInteger(kg) ? `${kg}` : kg.toFixed(1).replace('.', ',');
}

function roundToStep(kg: number): number {
  return Math.max(0, Math.round(kg / WEIGHT_STEP_KG) * WEIGHT_STEP_KG);
}

function sessionWeight(session: Session): number | null {
  const weights = session.map((set) => set.weightKg).filter((w): w is number => w !== null);
  return weights.length > 0 ? Math.max(...weights) : null;
}

function hitTop(session: Session, target: ProgressionTarget): boolean {
  return session.length >= target.targetSets && session.every((set) => set.reps >= target.repMax);
}

function missedBottom(session: Session, target: ProgressionTarget): boolean {
  return session.some((set) => set.reps < target.repMin);
}

function averageRpe(sessions: Session[]): number | null {
  const values = sessions.flat().map((set) => set.rpe).filter((rpe): rpe is number => rpe !== null);
  return values.length > 0 ? values.reduce((sum, rpe) => sum + rpe, 0) / values.length : null;
}

export function suggestNext(target: ProgressionTarget, history: Session[]): Suggestion {
  const [last, previous] = history;
  const range = `${target.repMin}-${target.repMax}`;

  if (target.isBodyweight) {
    if (last && hitTop(last, target)) {
      return {
        weightKg: null,
        kind: 'increase',
        reason: `Geçen sefer tüm setlerde ${target.repMax} tekrara ulaştın. Bugün her sette bir tekrar fazlasını dene.`,
      };
    }
    return { weightKg: null, kind: 'bodyweight', reason: `Vücut ağırlığıyla, her sette ${range} tekrar.` };
  }

  const lastWeight = last ? sessionWeight(last) : null;
  if (!last || lastWeight === null) {
    return {
      weightKg: target.startWeightKg ?? 0,
      kind: 'start',
      reason: 'İlk kez yapıyorsun: başlangıç ağırlığıyla tekniğe odaklan.',
    };
  }

  const previousWeight = previous ? sessionWeight(previous) : null;
  const twoAtSameWeight = previous !== undefined && previousWeight === lastWeight;

  if (twoAtSameWeight && hitTop(last, target) && hitTop(previous, target)) {
    const rpe = averageRpe([last, previous]);
    if (rpe === null || rpe <= MAX_RPE_FOR_INCREASE) {
      const next = roundToStep(lastWeight + (target.isLowerBody ? INCREMENT_KG.lower : INCREMENT_KG.upper));
      const effort = rpe === null ? '' : ` (ortalama zorluk RPE ${formatKg(Math.round(rpe * 10) / 10)})`;
      return {
        weightKg: next,
        kind: 'increase',
        reason: `Son iki antrenmanda ${formatKg(lastWeight)} kg ile tüm setlerde ${target.repMax} tekrarı tamamladın${effort}. Bugün ${formatKg(next)} kg dene.`,
      };
    }
    return {
      weightKg: lastWeight,
      kind: 'hold',
      reason: `Tekrarlar tamam ama zorlanarak (RPE 8 üstü). ${formatKg(lastWeight)} kg ile biraz daha rahatlayınca artıracağız.`,
    };
  }

  if (previous !== undefined && missedBottom(last, target) && missedBottom(previous, target)) {
    const next = Math.min(roundToStep(lastWeight * DELOAD_FACTOR), roundToStep(lastWeight - WEIGHT_STEP_KG));
    return {
      weightKg: next,
      kind: 'deload',
      reason: `Son iki antrenmanda ${target.repMin} tekrarın altında kalan setler oldu. ${formatKg(next)} kg ile tekniği toparlayıp yeniden yükseleceğiz.`,
    };
  }

  if (hitTop(last, target)) {
    return {
      weightKg: lastWeight,
      kind: 'hold',
      reason: `Geçen sefer tüm setlerde ${target.repMax} tekrar yaptın. Bugün de yaparsan bir sonraki antrenmanda ağırlık artacak.`,
    };
  }

  return {
    weightKg: lastWeight,
    kind: 'hold',
    reason: `${formatKg(lastWeight)} kg ile devam. Hedef: tüm setlerde ${target.repMax} tekrar.`,
  };
}

/** "30 kg · 10, 10, 9" or, when the weight changed between sets, "30 kg × 10, 27,5 kg × 9". */
export function describeSession(session: Session): string | null {
  if (session.length === 0) return null;
  const weights = new Set(session.map((set) => set.weightKg));
  if (weights.size === 1) {
    const [weight] = weights;
    const reps = session.map((set) => set.reps).join(', ');
    return weight === null || weight === undefined ? `${reps} tekrar` : `${formatKg(weight)} kg · ${reps}`;
  }
  return session.map((set) => (set.weightKg === null ? `${set.reps}` : `${formatKg(set.weightKg)} kg × ${set.reps}`)).join(', ');
}
