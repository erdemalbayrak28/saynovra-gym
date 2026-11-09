import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { Check, Lightbulb, Minus, Plus, SkipForward, Trophy, X } from 'lucide-react-native';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { WorkoutDto, WorkoutItemPlan, WorkoutSummary } from '../../../shared/contract';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { flowReducer, initFlow, progressOf, type Flow, type FlowEvent } from '@/lib/workout-flow';
import { Body, Button, Card, Label, Screen, Title } from '@/ui/components';
import { kg, setsText } from '@/ui/format';
import { colors, fonts, radius, space } from '@/ui/theme';

type Action = FlowEvent | { type: 'init'; workout: WorkoutDto };

function reducer(state: Flow | null, action: Action): Flow | null {
  if (action.type === 'init') return initFlow(action.workout);
  return state ? flowReducer(state, action) : state;
}

/** Effort after a set, recorded as RPE (rate of perceived exertion, 10 = nothing left). */
const EFFORT = [
  { label: 'Kolay', rpe: 7 },
  { label: 'İyi', rpe: 8 },
  { label: 'Zorlandım', rpe: 9.5 },
] as const;

export default function WorkoutScreen() {
  useKeepAwake();
  const { session } = useSession();
  const token = session?.token ?? null;
  const [flow, dispatch] = useReducer(reducer, null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Starts the next programme day, or resumes the one in progress.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.startWorkout(token).then(
      (workout) => {
        if (!cancelled) dispatch({ type: 'init', workout });
      },
      (err: unknown) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Antrenman açılamadı');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  const retry = useCallback(() => {
    setLoadError(null);
    setAttempt((n) => n + 1);
  }, []);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await task();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'İşlem tamamlanamadı');
    } finally {
      setBusy(false);
    }
  };

  const finish = () =>
    run(async () => {
      if (!token || !flow) return;
      setSummary(await api.finishWorkout(token, flow.workout.id));
    });

  const confirmLeave = () => {
    if (!flow || !token) {
      router.back();
      return;
    }
    Alert.alert('Antrenmandan çık', 'Yaptığın setler kayıtlı. Ne yapmak istersin?', [
      { text: 'Devam et', style: 'cancel' },
      { text: 'Şimdilik çık', onPress: () => router.back() },
      { text: 'Bitir ve kaydet', onPress: () => void finish() },
      {
        text: 'İptal et',
        style: 'destructive',
        onPress: () => void run(async () => {
          await api.discardWorkout(token, flow.workout.id);
          router.back();
        }),
      },
    ]);
  };

  if (summary) return <SummaryView summary={summary} />;

  if (!flow) {
    return (
      <Screen>
        {loadError ? (
          <Card>
            <Body style={{ color: colors.bad }}>{loadError}</Body>
            <Button title="Tekrar dene" onPress={retry} />
            <Button title="Geri dön" variant="ghost" onPress={() => router.back()} />
          </Card>
        ) : (
          <ActivityIndicator color={colors.lime} style={{ marginTop: 120 }} />
        )}
      </Screen>
    );
  }

  const { done, total } = progressOf(flow);
  const plan = flow.workout.items[flow.cursor.itemIndex];

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={confirmLeave} accessibilityRole="button" accessibilityLabel="Antrenmandan çık" hitSlop={12} style={styles.close}>
          <X size={20} color={colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Label numberOfLines={1}>{`Gün ${flow.workout.dayIndex}/${flow.workout.dayCount} · ${flow.workout.programName}`}</Label>
          <Text style={styles.dayName} numberOfLines={1}>
            {flow.workout.dayName}
          </Text>
        </View>
        <Text style={styles.count}>{`${done}/${total}`}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${total ? (done / total) * 100 : 0}%` }]} />
      </View>

      {actionError && <Body style={{ color: colors.bad }}>{actionError}</Body>}

      {flow.phase === 'set' && plan && (
        <SetView
          flow={flow}
          plan={plan}
          busy={busy}
          onAdjustWeight={(delta) => dispatch({ type: 'adjustWeight', delta })}
          onAdjustReps={(delta) => dispatch({ type: 'adjustReps', delta })}
          onSkip={() => dispatch({ type: 'skipExercise' })}
          onComplete={() =>
            run(async () => {
              if (!token) return;
              const saved = await api.logSet(token, flow.workout.id, {
                programItemId: plan.item.id,
                setNo: flow.cursor.setNo,
                weightKg: plan.item.exercise.isBodyweight ? null : flow.weightKg,
                reps: flow.reps,
                rpe: null,
              });
              dispatch({ type: 'logged', set: saved, now: Date.now() });
            })
          }
        />
      )}

      {flow.phase === 'rest' && plan && (
        <RestView
          flow={flow}
          plan={plan}
          onDone={() => dispatch({ type: 'restDone' })}
          onExtend={() => dispatch({ type: 'extendRest', ms: 15_000, now: Date.now() })}
          onRate={(rpe) => {
            const last = flow.lastLogged;
            if (!token || !last) return;
            const rated = { ...last, rpe };
            dispatch({ type: 'rated', set: rated });
            api.logSet(token, flow.workout.id, rated).catch(() => setActionError('Zorluk kaydedilemedi'));
          }}
        />
      )}

      {flow.phase === 'done' && (
        <Card style={{ borderColor: colors.lime, gap: space.lg }}>
          <Title style={{ fontSize: 22 }}>{done >= total ? 'Tüm setler tamam' : 'Kalan hareket yok'}</Title>
          <Body>{`${done} set kaydedildi. Bitirince program bir sonraki güne geçer.`}</Body>
          <Button title="Antrenmanı bitir" onPress={() => void finish()} loading={busy} icon={<Check size={18} color={colors.ink} />} />
        </Card>
      )}
    </Screen>
  );
}

function SetView({
  flow,
  plan,
  busy,
  onAdjustWeight,
  onAdjustReps,
  onSkip,
  onComplete,
}: {
  flow: Flow;
  plan: WorkoutItemPlan;
  busy: boolean;
  onAdjustWeight: (delta: number) => void;
  onAdjustReps: (delta: number) => void;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const { item, suggestion } = plan;
  const bodyweight = item.exercise.isBodyweight;
  return (
    <>
      <Card style={{ gap: space.md }}>
        <Label style={{ color: colors.lime }}>
          {`Hareket ${flow.cursor.itemIndex + 1}/${flow.workout.items.length} · Set ${flow.cursor.setNo}/${item.targetSets}`}
        </Label>
        <Text style={styles.exercise}>{item.exercise.name}</Text>
        <Body>{`${item.exercise.muscleGroup} · ${item.exercise.equipment} · hedef ${setsText(item.targetSets, item.repMin, item.repMax)}`}</Body>

        {flow.cursor.setNo === 1 && (
          <View style={[styles.suggestion, suggestion.kind === 'deload' && { borderColor: 'rgba(77,184,255,0.45)' }]}>
            <Label style={{ color: suggestion.kind === 'increase' ? colors.lime : colors.text }}>
              {suggestion.kind === 'increase' ? 'Ağırlık artışı önerisi' : suggestion.kind === 'deload' ? 'Hafifletme önerisi' : 'Bugünkü hedef'}
            </Label>
            <Body style={{ color: colors.text }}>{suggestion.reason}</Body>
            {plan.lastTime && <Body>{`Geçen sefer: ${plan.lastTime}`}</Body>}
          </View>
        )}

        <View style={styles.steppers}>
          {!bodyweight && flow.weightKg !== null && (
            <Stepper value={`${kg(flow.weightKg)} kg`} label="Ağırlık" onMinus={() => onAdjustWeight(-1)} onPlus={() => onAdjustWeight(1)} />
          )}
          <Stepper value={`${flow.reps}`} label={`Tekrar (hedef ${item.repMin}-${item.repMax})`} onMinus={() => onAdjustReps(-1)} onPlus={() => onAdjustReps(1)} />
        </View>

        <View style={styles.cue}>
          <Lightbulb size={16} color={colors.muted} />
          <Body style={{ flex: 1 }}>{item.exercise.cue}</Body>
        </View>
      </Card>

      <Button title="Seti tamamladım" onPress={onComplete} loading={busy} icon={<Check size={20} color={colors.ink} />} />
      <Button title="Bu hareketi atla" variant="ghost" onPress={onSkip} disabled={busy} icon={<SkipForward size={18} color={colors.text} />} />
    </>
  );
}

function Stepper({ value, label, onMinus, onPlus }: { value: string; label: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.stepper}>
      <Body style={{ textAlign: 'center' }}>{label}</Body>
      <View style={styles.stepperRow}>
        <Pressable onPress={onMinus} accessibilityRole="button" accessibilityLabel={`${label} azalt`} style={styles.stepButton} hitSlop={8}>
          <Minus size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.stepValue}>{value}</Text>
        <Pressable onPress={onPlus} accessibilityRole="button" accessibilityLabel={`${label} artır`} style={styles.stepButton} hitSlop={8}>
          <Plus size={20} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const RING = 220;
const STROKE = 12;

function RestView({
  flow,
  plan,
  onDone,
  onExtend,
  onRate,
}: {
  flow: Flow;
  plan: WorkoutItemPlan;
  onDone: () => void;
  onExtend: () => void;
  onRate: (rpe: number) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const endsAt = flow.restEndsAt ?? now;
  const remainingMs = Math.max(0, endsAt - now);
  const previousPlan = flow.lastLogged ? flow.workout.items.find((p) => p.item.id === flow.lastLogged?.programItemId) : undefined;
  const totalMs = Math.max(remainingMs, (previousPlan?.item.restSec ?? plan.item.restSec) * 1000);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (remainingMs > 0) return;
    Vibration.vibrate(400);
    onDone();
  }, [remainingMs, onDone]);

  const seconds = Math.ceil(remainingMs / 1000);
  const circumference = Math.PI * (RING - STROKE);
  const nextIsNewExercise = flow.cursor.setNo === 1;

  return (
    <>
      <Card style={{ alignItems: 'center', gap: space.lg }}>
        <Label>Dinlen</Label>
        <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
            <Circle cx={RING / 2} cy={RING / 2} r={(RING - STROKE) / 2} stroke={colors.surface2} strokeWidth={STROKE} fill="none" />
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={(RING - STROKE) / 2}
              stroke={colors.lime}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - remainingMs / totalMs)}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          <Text style={styles.timer}>{`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}</Text>
        </View>
        <View style={styles.restActions}>
          <View style={{ flex: 1 }}>
            <Button title="+15 sn" variant="ghost" onPress={onExtend} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Atla" variant="ghost" onPress={onDone} />
          </View>
        </View>
      </Card>

      {flow.lastLogged && (
        <Card>
          <Label>Son set nasıldı?</Label>
          <View style={styles.effortRow}>
            {EFFORT.map((option) => {
              const selected = flow.lastLogged?.rpe === option.rpe;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => onRate(option.rpe)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.effort, selected && styles.effortSelected]}
                >
                  <Text style={[styles.effortText, selected && { color: colors.ink }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Body>Ağırlık önerisi bu cevaba da bakar.</Body>
        </Card>
      )}

      <Card>
        <Label>{nextIsNewExercise ? 'Sıradaki hareket' : 'Sıradaki set'}</Label>
        <Text style={styles.nextName}>{plan.item.exercise.name}</Text>
        <Body>
          {`Set ${flow.cursor.setNo}/${plan.item.targetSets} · `}
          {plan.item.exercise.isBodyweight || flow.weightKg === null ? `${flow.reps} tekrar` : `${kg(flow.weightKg)} kg × ${flow.reps}`}
        </Body>
      </Card>
    </>
  );
}

function SummaryView({ summary }: { summary: WorkoutSummary }) {
  return (
    <Screen>
      <View style={{ gap: space.xs, paddingTop: space.xl }}>
        <Label style={{ color: colors.lime }}>Antrenman tamamlandı</Label>
        <Title>İyi iş çıkardın</Title>
      </View>
      <View style={styles.stats}>
        <Stat label="Süre" value={`${summary.durationMinutes} dk`} />
        <Stat label="Set" value={`${summary.totalSets}`} />
        <Stat label="Tekrar" value={`${summary.totalReps}`} />
        <Stat label="Hacim" value={`${kg(Math.round(summary.volumeKg / 100) / 10)} t`} />
      </View>
      {summary.records.length > 0 && (
        <Card style={{ borderColor: colors.lime }}>
          <View style={styles.inline}>
            <Trophy size={18} color={colors.lime} />
            <Label style={{ color: colors.lime }}>Yeni rekor</Label>
          </View>
          {summary.records.map((record) => (
            <Body key={record.exerciseName} style={{ color: colors.text }}>{`${record.exerciseName}: ${kg(record.weightKg)} kg`}</Body>
          ))}
        </Card>
      )}
      <Card>
        <Label>Sıradaki antrenman</Label>
        <Text style={styles.nextName}>{summary.nextDayName}</Text>
      </Card>
      <Button title="Tamam" onPress={() => router.back()} />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Label>{label}</Label>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm },
  // minWidth 0 lets single-line text shrink inside a row; without it the web build overflows.
  headerText: { flex: 1, minWidth: 0 },
  close: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  dayName: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  count: { fontFamily: fonts.mono, fontSize: 14, color: colors.lime },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surface2, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.lime },
  exercise: { fontFamily: fonts.display, fontSize: 26, color: colors.text, letterSpacing: -0.4 },
  suggestion: { gap: 6, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(200,240,49,0.45)', backgroundColor: colors.limeSoft },
  steppers: { gap: space.md },
  stepper: { gap: 6, padding: space.md, borderRadius: radius.md, backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.line },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepButton: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  stepValue: { fontFamily: fonts.display, fontSize: 32, color: colors.text },
  cue: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  timer: { fontFamily: fonts.display, fontSize: 56, color: colors.text, letterSpacing: -1 },
  restActions: { flexDirection: 'row', gap: space.md, alignSelf: 'stretch' },
  effortRow: { flexDirection: 'row', gap: space.sm },
  effort: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  effortSelected: { backgroundColor: colors.lime, borderColor: colors.lime },
  effortText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  nextName: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  stat: { flexBasis: '47%', flexGrow: 1, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 4 },
  statValue: { fontFamily: fonts.display, fontSize: 26, color: colors.lime },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
