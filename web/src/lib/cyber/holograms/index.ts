/** One hologram per NOVRA GYM feature. */
import type { HologramKind } from '../config';
import { drawForm } from './form';
import type { Holo } from './holo';
import { drawOccupancy } from './occupancy';
import { drawProgress } from './progress';
import { drawQr } from './qr';
import { drawRadar } from './radar';
import { drawWorkout } from './workout';

export const HOLOGRAMS: Record<HologramKind, (holo: Holo) => void> = {
  occupancy: drawOccupancy,
  qr: drawQr,
  workout: drawWorkout,
  progress: drawProgress,
  radar: drawRadar,
  form: drawForm,
};
