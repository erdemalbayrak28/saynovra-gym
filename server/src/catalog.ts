// Exercise and programme library. Reference data: seeded once, read by everyone.
import type { ProgramGoal, ProgramLevel } from '../../shared/contract.ts';
import type { Db } from './db.ts';

interface ExerciseSeed {
  slug: string;
  name: string;
  muscle: string;
  equipment: string;
  lower?: boolean;
  bodyweight?: boolean;
  cue: string;
}

export const EXERCISES: readonly ExerciseSeed[] = [
  { slug: 'bench-press', name: 'Bench Press', muscle: 'Göğüs', equipment: 'Barbell', cue: 'Kürek kemiklerini sıkıştır, barı göğüs ortasına kontrollü indir.' },
  { slug: 'incline-db-press', name: 'Eğimli Dumbbell Press', muscle: 'Üst göğüs', equipment: 'Dumbbell', cue: 'Sehpa 30 derece. Dirsekler gövdeyle 45 derece açı yapsın.' },
  { slug: 'cable-fly', name: 'Kablo Fly', muscle: 'Göğüs', equipment: 'Kablo', cue: 'Kollar hafif bükük, elleri göğüs hizasında buluştur.' },
  { slug: 'push-up', name: 'Şınav', muscle: 'Göğüs', equipment: 'Vücut ağırlığı', bodyweight: true, cue: 'Gövde dümdüz, göğüs yere yaklaşınca it.' },
  { slug: 'ohp', name: 'Omuz Press', muscle: 'Omuz', equipment: 'Barbell', cue: 'Karın ve kalça sıkı, barı başın üstünde kilitle.' },
  { slug: 'db-shoulder-press', name: 'Dumbbell Omuz Press', muscle: 'Omuz', equipment: 'Dumbbell', cue: 'Belini sehpadan ayırma, ağırlıkları kulak hizasına indir.' },
  { slug: 'lateral-raise', name: 'Yana Açış', muscle: 'Yan omuz', equipment: 'Dumbbell', cue: 'Dirsekler omuz hizasını geçmesin, yavaş indir.' },
  { slug: 'triceps-pushdown', name: 'Triceps Pushdown', muscle: 'Arka kol', equipment: 'Kablo', cue: 'Dirsekler gövdeye yapışık, yalnızca ön kol hareket eder.' },
  { slug: 'lat-pulldown', name: 'Geniş Tutuş Lat Pulldown', muscle: 'Sırt', equipment: 'Kablo', cue: 'Barı göğsün üstüne çek, gövdeyi hafif geriye yasla.' },
  { slug: 'barbell-row', name: 'Barbell Row', muscle: 'Sırt', equipment: 'Barbell', cue: 'Sırt düz, gövde 45 derece; barı göbeğe doğru çek.' },
  { slug: 'seated-cable-row', name: 'Oturarak Kablo Row', muscle: 'Sırt', equipment: 'Kablo', cue: 'Kürek kemiklerini birleştirerek çek, omuzları kaldırma.' },
  { slug: 'pull-up', name: 'Barfiks', muscle: 'Sırt', equipment: 'Vücut ağırlığı', bodyweight: true, cue: 'Göğüs bara yaklaşana kadar çek, sallanma.' },
  { slug: 'face-pull', name: 'Face Pull', muscle: 'Arka omuz', equipment: 'Kablo', cue: 'İpi yüzüne doğru çek, dirsekler yukarıda.' },
  { slug: 'biceps-curl', name: 'Dumbbell Biceps Curl', muscle: 'Ön kol', equipment: 'Dumbbell', cue: 'Dirsekler sabit, kaldırırken bileğini dışa çevir.' },
  { slug: 'hammer-curl', name: 'Hammer Curl', muscle: 'Ön kol', equipment: 'Dumbbell', cue: 'Avuç içleri birbirine bakar, gövdeyi sallama.' },
  { slug: 'squat', name: 'Squat', muscle: 'Bacak', equipment: 'Barbell', lower: true, cue: 'Dizler ayak uçlarıyla aynı yönde, kalça diz hizasına insin.' },
  { slug: 'goblet-squat', name: 'Goblet Squat', muscle: 'Bacak', equipment: 'Dumbbell', lower: true, cue: 'Ağırlığı göğsünde tut, dirsekler dizlerin içine insin.' },
  { slug: 'leg-press', name: 'Leg Press', muscle: 'Bacak', equipment: 'Makine', lower: true, cue: 'Bel sehpadan kalkmasın, dizleri tam kilitleme.' },
  { slug: 'rdl', name: 'Romanian Deadlift', muscle: 'Arka bacak', equipment: 'Barbell', lower: true, cue: 'Kalçayı geriye it, bar bacaklara yakın insin.' },
  { slug: 'deadlift', name: 'Deadlift', muscle: 'Sırt ve bacak', equipment: 'Barbell', lower: true, cue: 'Bar ayak ortasının üstünde, sırt düz; yeri bacaklarla it.' },
  { slug: 'leg-curl', name: 'Leg Curl', muscle: 'Arka bacak', equipment: 'Makine', lower: true, cue: 'Kalça sehpada kalsın, yavaş bırak.' },
  { slug: 'leg-extension', name: 'Leg Extension', muscle: 'Ön bacak', equipment: 'Makine', lower: true, cue: 'Üstte bir saniye sık, kontrollü indir.' },
  { slug: 'walking-lunge', name: 'Yürüyerek Lunge', muscle: 'Bacak', equipment: 'Dumbbell', lower: true, cue: 'Ön diz ayak bileğinin üstünde, arka diz yere yaklaşsın.' },
  { slug: 'hip-thrust', name: 'Hip Thrust', muscle: 'Kalça', equipment: 'Barbell', lower: true, cue: 'Üstte kalçayı sık, beli bükme.' },
  { slug: 'calf-raise', name: 'Calf Raise', muscle: 'Baldır', equipment: 'Makine', lower: true, cue: 'Tam aşağı in, parmak ucunda bir saniye bekle.' },
  { slug: 'kettlebell-swing', name: 'Kettlebell Swing', muscle: 'Tüm vücut', equipment: 'Kettlebell', lower: true, cue: 'Güç kalçadan gelir, kollar yalnızca yönlendirir.' },
  { slug: 'crunch', name: 'Mekik', muscle: 'Karın', equipment: 'Vücut ağırlığı', bodyweight: true, cue: 'Boynu çekme, karınla kalk.' },
  { slug: 'hanging-knee-raise', name: 'Asılı Diz Çekme', muscle: 'Karın', equipment: 'Vücut ağırlığı', bodyweight: true, cue: 'Sallanmadan dizleri göğse çek.' },
  { slug: 'burpee', name: 'Burpee', muscle: 'Tüm vücut', equipment: 'Vücut ağırlığı', bodyweight: true, cue: 'Yere in, şınav pozisyonu, sıçrayarak kalk.' },
];

/** [exercise slug, sets, rep min, rep max, rest seconds, start weight kg or null] */
type ItemSeed = readonly [string, number, number, number, number, number | null];

interface ProgramSeed {
  slug: string;
  name: string;
  goal: ProgramGoal;
  level: ProgramLevel;
  daysPerWeek: number;
  weeks: number;
  description: string;
  days: { name: string; focus: string; items: ItemSeed[] }[];
}

export const PROGRAMS: readonly ProgramSeed[] = [
  {
    slug: 'baslangic-tum-vucut',
    name: 'Başlangıç: Tüm Vücut',
    goal: 'beginner',
    level: 'beginner',
    daysPerWeek: 3,
    weeks: 8,
    description: 'Salona yeni başlayanlar için. Haftada 3 gün, iki antrenman sırayla; temel hareketlerle tekniği oturtur.',
    days: [
      { name: 'Tüm Vücut A', focus: 'Bacak, göğüs, sırt', items: [['goblet-squat', 3, 10, 12, 90, 12], ['bench-press', 3, 8, 10, 120, 30], ['lat-pulldown', 3, 10, 12, 90, 35], ['db-shoulder-press', 2, 10, 12, 90, 8], ['crunch', 3, 12, 15, 60, null]] },
      { name: 'Tüm Vücut B', focus: 'Kalça, üst göğüs, sırt', items: [['rdl', 3, 8, 10, 120, 30], ['incline-db-press', 3, 10, 12, 90, 10], ['seated-cable-row', 3, 10, 12, 90, 30], ['leg-press', 3, 10, 12, 90, 60], ['biceps-curl', 2, 12, 15, 60, 6]] },
    ],
  },
  {
    slug: 'hipertrofi-ust-alt',
    name: 'Hipertrofi: Üst / Alt',
    goal: 'hypertrophy',
    level: 'intermediate',
    daysPerWeek: 4,
    weeks: 10,
    description: 'Kas kütlesi için haftada 4 gün: iki üst, iki alt vücut günü. Tekrar aralığının tepesine ulaşınca ağırlık artar.',
    days: [
      { name: 'Üst A · Göğüs ve Sırt', focus: 'Göğüs, sırt, arka kol', items: [['incline-db-press', 4, 8, 10, 120, 22.5], ['lat-pulldown', 3, 10, 12, 90, 55], ['barbell-row', 3, 8, 10, 120, 50], ['cable-fly', 3, 12, 15, 60, 10], ['triceps-pushdown', 3, 10, 12, 60, 20]] },
      { name: 'Alt A · Squat Günü', focus: 'Ön bacak, arka bacak, baldır', items: [['squat', 4, 6, 8, 150, 60], ['rdl', 3, 8, 10, 120, 60], ['leg-extension', 3, 12, 15, 75, 35], ['calf-raise', 4, 12, 15, 60, 40], ['hanging-knee-raise', 3, 10, 15, 60, null]] },
      { name: 'Üst B · Omuz ve Kol', focus: 'Omuz, sırt, kollar', items: [['ohp', 4, 6, 8, 150, 35], ['pull-up', 3, 6, 10, 120, null], ['seated-cable-row', 3, 10, 12, 90, 50], ['lateral-raise', 3, 12, 15, 60, 8], ['biceps-curl', 3, 10, 12, 60, 12], ['face-pull', 3, 12, 15, 60, 15]] },
      { name: 'Alt B · Kalça Günü', focus: 'Kalça, arka bacak', items: [['deadlift', 3, 5, 6, 180, 90], ['leg-press', 3, 10, 12, 120, 120], ['walking-lunge', 3, 10, 12, 90, 14], ['leg-curl', 3, 10, 12, 75, 35], ['hip-thrust', 3, 8, 10, 90, 60]] },
    ],
  },
  {
    slug: 'push-pull-legs',
    name: 'Push / Pull / Legs',
    goal: 'hypertrophy',
    level: 'advanced',
    daysPerWeek: 6,
    weeks: 8,
    description: 'Deneyimliler için: itiş, çekiş ve bacak günleri haftada iki tur. Yüksek hacim, sık antrenman.',
    days: [
      { name: 'İtiş', focus: 'Göğüs, omuz, arka kol', items: [['bench-press', 4, 6, 8, 150, 60], ['incline-db-press', 3, 8, 10, 120, 22.5], ['db-shoulder-press', 3, 8, 10, 90, 18], ['lateral-raise', 3, 12, 15, 60, 8], ['triceps-pushdown', 3, 10, 12, 60, 22.5]] },
      { name: 'Çekiş', focus: 'Sırt, arka omuz, ön kol', items: [['deadlift', 3, 5, 5, 180, 100], ['pull-up', 3, 6, 10, 120, null], ['barbell-row', 3, 8, 10, 120, 60], ['face-pull', 3, 12, 15, 60, 15], ['hammer-curl', 3, 10, 12, 60, 14]] },
      { name: 'Bacak', focus: 'Ön ve arka bacak, baldır', items: [['squat', 4, 6, 8, 150, 80], ['rdl', 3, 8, 10, 120, 70], ['leg-press', 3, 10, 12, 120, 140], ['leg-curl', 3, 10, 12, 75, 40], ['calf-raise', 4, 12, 15, 60, 50]] },
    ],
  },
  {
    slug: 'guc-5x5',
    name: 'Güç: 5x5',
    goal: 'strength',
    level: 'intermediate',
    daysPerWeek: 3,
    weeks: 12,
    description: 'Temel güç için iki antrenman sırayla: her harekette 5 set 5 tekrar. Az hareket, ağır ağırlık, uzun dinlenme.',
    days: [
      { name: 'Antrenman A', focus: 'Squat, bench, row', items: [['squat', 5, 5, 5, 180, 60], ['bench-press', 5, 5, 5, 180, 50], ['barbell-row', 5, 5, 5, 150, 45]] },
      { name: 'Antrenman B', focus: 'Squat, omuz, deadlift', items: [['squat', 5, 5, 5, 180, 60], ['ohp', 5, 5, 5, 180, 30], ['deadlift', 1, 5, 5, 240, 80]] },
    ],
  },
  {
    slug: 'kondisyon-yag-yakimi',
    name: 'Kondisyon ve Yağ Yakımı',
    goal: 'fat_loss',
    level: 'beginner',
    daysPerWeek: 3,
    weeks: 6,
    description: 'Kısa dinlenmelerle tüm vücut çalışır, nabız yüksek kalır. Kilo verme hedefinde beslenmeyle birlikte en iyi sonucu verir.',
    days: [
      { name: 'Devre A', focus: 'Tüm vücut, yüksek tempo', items: [['goblet-squat', 3, 12, 15, 45, 12], ['push-up', 3, 8, 15, 45, null], ['kettlebell-swing', 3, 15, 20, 45, 12], ['seated-cable-row', 3, 12, 15, 45, 30], ['burpee', 3, 8, 12, 45, null]] },
      { name: 'Devre B', focus: 'Tüm vücut, yüksek tempo', items: [['walking-lunge', 3, 10, 12, 45, 8], ['db-shoulder-press', 3, 12, 15, 45, 8], ['lat-pulldown', 3, 12, 15, 45, 35], ['hip-thrust', 3, 12, 15, 45, 40], ['crunch', 3, 15, 20, 45, null]] },
    ],
  },
];

/** Inserts the library. Returns program ids by slug. */
export function seedCatalog(db: Db, now: Date): Map<string, number> {
  const stamp = now.toISOString();
  const exerciseIds = new Map<string, number>();
  const insertExercise = db.prepare(
    'INSERT INTO exercises (slug, name, muscle_group, equipment, is_lower_body, is_bodyweight, cue) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  for (const e of EXERCISES) {
    const result = insertExercise.run(e.slug, e.name, e.muscle, e.equipment, e.lower ? 1 : 0, e.bodyweight ? 1 : 0, e.cue);
    exerciseIds.set(e.slug, Number(result.lastInsertRowid));
  }

  const programIds = new Map<string, number>();
  for (const p of PROGRAMS) {
    const program = db
      .prepare(
        `INSERT INTO programs (slug, name, goal, level, days_per_week, weeks, description, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(p.slug, p.name, p.goal, p.level, p.daysPerWeek, p.weeks, p.description, stamp, stamp);
    const programId = Number(program.lastInsertRowid);
    programIds.set(p.slug, programId);

    p.days.forEach((day, dayIdx) => {
      const dayRow = db
        .prepare('INSERT INTO program_days (program_id, day_index, name, focus) VALUES (?, ?, ?, ?)')
        .run(programId, dayIdx + 1, day.name, day.focus);
      const dayId = Number(dayRow.lastInsertRowid);
      day.items.forEach(([slug, sets, repMin, repMax, restSec, startKg], order) => {
        const exerciseId = exerciseIds.get(slug);
        if (exerciseId === undefined) throw new Error(`Catalog: unknown exercise "${slug}" in ${p.slug}`);
        db.prepare(
          `INSERT INTO program_items (program_day_id, exercise_id, sort_order, target_sets, rep_min, rep_max, rest_sec, start_weight_kg)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(dayId, exerciseId, order + 1, sets, repMin, repMax, restSec, startKg);
      });
    });
  }
  return programIds;
}
