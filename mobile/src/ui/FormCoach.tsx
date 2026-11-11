import { useFocusEffect } from 'expo-router';
import { Camera, RotateCcw, SwitchCamera } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { useCameraPermissions } from 'expo-camera';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import WebViewBase, { type WebViewMessageEvent } from 'react-native-webview';
import type { AndroidWebViewProps } from 'react-native-webview/lib/WebViewTypes';
import {
  EXERCISES,
  NOTABLE_SLOWDOWN,
  coaching,
  countedReps,
  faultText,
  repFaults,
  slowdown,
  type ExerciseId,
} from '../../../shared/pose';
import {
  SENSOR_PAGE_BASE_URL,
  SENSOR_PAGE_HTML,
  commandScript,
  parseSensorMessage,
  type SensorCommand,
  type SensorFacing,
} from '@/lib/pose/sensor-page';
import { useFormAnalysis } from '@/lib/pose/useFormAnalysis';
import { Body, Button, Card, Label } from './components';
import { colors, fonts, radius, space } from './theme';

interface WebViewHandle {
  injectJavaScript: (script: string) => void;
}
// The package types its component with the iOS, Android and Windows props intersected, which the
// React Native 0.88 types reduce to never. This app ships for Android; type it with those props.
const WebView = WebViewBase as unknown as ComponentType<AndroidWebViewProps & { ref?: Ref<WebViewHandle> }>;

type Stage =
  | { kind: 'permission' }
  | { kind: 'loading' }
  | { kind: 'ready'; delegate: 'GPU' | 'CPU' | null }
  | { kind: 'running'; delegate: 'GPU' | 'CPU' | null }
  | { kind: 'error'; message: string; settings: boolean };

const EXERCISE_IDS = Object.keys(EXERCISES) as ExerciseId[];
const REPS_SHOWN = 6;

const ERROR_TEXT = {
  insecure: 'Bu cihazdaki tarayıcı bileşeni kameraya izin vermiyor.',
  model: 'Model yüklenemedi. İnternet bağlantısını kontrol et; model ilk açılışta indirilir (yaklaşık 6 MB).',
  camera_denied: 'Kamera izni verilmedi. Ayarlardan uygulamaya kamera izni ver.',
  camera: 'Kamera açılamadı. Başka bir uygulama kullanıyorsa kapatıp tekrar dene.',
  permission_timeout: 'Kamera izni yanıt vermedi. Tekrar dene; olmazsa Ayarlar > Uygulamalar > Expo Go > İzinler bölümünden kamerayı aç.',
} as const;

const TONE = {
  idle: { color: colors.text, border: colors.line },
  info: { color: colors.info, border: 'rgba(77,184,255,0.4)' },
  good: { color: colors.ok, border: 'rgba(46,229,157,0.4)' },
  warn: { color: colors.bad, border: 'rgba(255,90,79,0.4)' },
} as const;

/** A permission prompt that never answers must not leave the screen waiting forever. */
const PERMISSION_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve('timeout'), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} sn`;

/**
 * Camera form coach. The camera and pose model run in a web view on the phone (see sensor-page.ts);
 * reps, depth, lockout and coaching come from shared/pose.ts, the same rules as the web page.
 */
export function FormCoach({ initialExercise = 'squat', initialFacing = 'user' }: { initialExercise?: ExerciseId; initialFacing?: SensorFacing }) {
  const webView = useRef<WebViewHandle>(null);
  const [exercise, setExercise] = useState<ExerciseId>(initialExercise);
  const [facing, setFacing] = useState<SensorFacing>(initialFacing);
  const [stage, setStage] = useState<Stage>({ kind: 'permission' });
  const [focused, setFocused] = useState(true);
  const spec = EXERCISES[exercise];
  const { view, onFrame, reset } = useFormAnalysis(spec);

  const send = useCallback((command: SensorCommand) => webView.current?.injectJavaScript(commandScript(command)), []);

  // Expo Go keeps camera permission per project, so it is asked through Expo's own camera module;
  // the web view inside then finds it granted and can open the camera.
  const [, requestCameraPermission] = useCameraPermissions();
  const askPermission = useCallback(async () => {
    setStage({ kind: 'permission' });
    const answer = await withTimeout(requestCameraPermission(), PERMISSION_TIMEOUT_MS).catch(() => null);
    if (answer === 'timeout') setStage({ kind: 'error', message: ERROR_TEXT.permission_timeout, settings: true });
    else if (answer?.granted) setStage({ kind: 'loading' });
    else setStage({ kind: 'error', message: ERROR_TEXT.camera_denied, settings: true });
  }, [requestCameraPermission]);

  // Ask once when the screen opens; the request function may change identity between renders.
  const askOnOpen = useRef(askPermission);
  useEffect(() => {
    void askOnOpen.current();
  }, []);

  // The camera runs only while the screen is in front (switching tabs or apps releases it).
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const delegate = stage.kind === 'ready' || stage.kind === 'running' ? stage.delegate : null;
  const canRun = stage.kind === 'ready' || stage.kind === 'running';
  useEffect(() => {
    if (!canRun) return;
    send(focused ? { type: 'start', facing } : { type: 'stop' });
  }, [canRun, focused, facing, send]);

  const onMessage = (event: WebViewMessageEvent) => {
    const message = parseSensorMessage(event.nativeEvent.data);
    if (!message) return;
    if (message.type === 'frame') {
      const snapshot = onFrame(message.at, message.aspect, message.points);
      if (snapshot) send({ type: 'overlay', chains: snapshot.chains, angle: snapshot.angle });
      return;
    }
    if (message.type === 'debug') {
      if (__DEV__) console.log('[form sensor]', message.text);
      return;
    }
    if (message.type === 'error') {
      setStage({ kind: 'error', message: ERROR_TEXT[message.reason], settings: message.reason === 'camera_denied' });
      return;
    }
    if (message.state === 'loading') setStage({ kind: 'loading' });
    else if (message.state === 'ready') setStage({ kind: 'ready', delegate: message.delegate ?? null });
    else setStage((current) => ({ kind: 'running', delegate: current.kind === 'ready' || current.kind === 'running' ? current.delegate : null }));
  };

  const choose = (next: ExerciseId) => {
    setExercise(next);
    reset();
  };

  const { counter } = view;
  const reps = countedReps(counter);
  const partial = counter.reps.length - reps;
  const lastCounted = [...counter.reps].reverse().find((rep) => rep.counted) ?? null;
  const loss = slowdown(counter.reps);
  const running = stage.kind === 'running';
  const tip = running ? coaching(counter, spec, view.visible) : null;

  return (
    <View style={{ gap: space.lg }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {EXERCISE_IDS.map((id) => {
          const selected = id === exercise;
          return (
            <Pressable
              key={id}
              onPress={() => choose(id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && { color: colors.ink }]}>{EXERCISES[id].name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.stage}>
        {stage.kind !== 'permission' && stage.kind !== 'error' && (
          <WebView
            ref={webView}
            source={{ html: SENSOR_PAGE_HTML, baseUrl: SENSOR_PAGE_BASE_URL }}
            originWhitelist={['*']}
            onMessage={onMessage}
            javaScriptEnabled
            mediaPlaybackRequiresUserAction={false}
            style={styles.webView}
            containerStyle={styles.webView}
            overScrollMode="never"
            webviewDebuggingEnabled={__DEV__}
          />
        )}
        {!running && (
          <View style={styles.cover} pointerEvents="box-none">
            {stage.kind === 'error' ? (
              <>
                <Text style={styles.coverError}>{stage.message}</Text>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button title="Tekrar dene" variant="ghost" onPress={() => void askPermission()} />
                  {stage.settings && <Button title="Ayarları aç" variant="ghost" onPress={() => void Linking.openSettings()} />}
                </View>
              </>
            ) : (
              <>
                {stage.kind === 'ready' ? <Camera size={28} color={colors.lime} /> : <ActivityIndicator color={colors.lime} />}
                <Text style={styles.coverTitle}>{spec.name}</Text>
                <Body style={{ textAlign: 'center' }}>{spec.setupHint}</Body>
                <Body style={{ textAlign: 'center', fontSize: 12 }}>
                  {stage.kind === 'permission' ? 'Kamera izni bekleniyor.' : stage.kind === 'loading' ? 'Model yükleniyor (ilk açılışta yaklaşık 6 MB).' : 'Kamera açılıyor.'}
                </Body>
              </>
            )}
          </View>
        )}
        {running && (
          <View style={styles.badges} pointerEvents="none">
            <Text style={styles.badge}>{`MediaPipe${delegate ? ` · ${delegate}` : ''}`}</Text>
            <Text style={styles.badge}>{`${view.fps} fps`}</Text>
            {view.angle !== null && <Text style={[styles.badge, { color: colors.lime }]}>{`${Math.round(view.angle)}°`}</Text>}
          </View>
        )}
        {running && (
          <View style={styles.repBadge} pointerEvents="none">
            <Text style={styles.repCount}>{reps}</Text>
            {partial > 0 && <Text style={styles.repPartial}>{`${partial} yarım`}</Text>}
          </View>
        )}
        {tip && (
          <View style={[styles.tip, { borderColor: TONE[tip.tone].border }]} pointerEvents="none" accessibilityLiveRegion="polite">
            <Text style={[styles.tipText, { color: TONE[tip.tone].color }]}>{tip.text}</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <Pressable onPress={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} accessibilityRole="button" style={styles.control} disabled={!canRun}>
          <SwitchCamera size={18} color={canRun ? colors.text : colors.muted} />
          <Text style={styles.controlText}>{facing === 'user' ? 'Arka kamera' : 'Ön kamera'}</Text>
        </Pressable>
        <Pressable onPress={reset} accessibilityRole="button" style={styles.control}>
          <RotateCcw size={18} color={colors.text} />
          <Text style={styles.controlText}>Sıfırla</Text>
        </Pressable>
      </View>

      <View style={styles.phases}>
        {(['top', 'down', 'bottom'] as const).map((phase) => (
          <Text key={phase} style={[styles.phase, running && counter.phase === phase && styles.phaseActive]}>
            {spec.phases[phase]}
          </Text>
        ))}
      </View>

      <View style={styles.metrics}>
        <Metric label={spec.angleLabel} value={view.angle === null ? '-' : `${Math.round(view.angle)}°`} hint={`${spec.phases.bottom} ≤ ${spec.bottomAngle}°`} />
        <Metric label={spec.texts.depthLabel} value={lastCounted ? `${Math.round(lastCounted.minAngle)}°` : '-'} hint={spec.lockoutAngle ? `Tam açılma ≥ ${spec.lockoutAngle}°` : 'En dip açı'} />
        <Metric label="Kaldırma" value={lastCounted ? seconds(lastCounted.liftMs) : '-'} hint={spec.texts.liftLabel} />
        <Metric label="Yavaşlama" value={loss === null ? '-' : `%${Math.round(loss * 100)}`} hint="İlk tekrara göre" bad={loss !== null && loss >= NOTABLE_SLOWDOWN} />
      </View>

      <Card>
        <Label>{`SET · ${spec.name.toLocaleUpperCase('tr-TR')}`}</Label>
        {counter.reps.length === 0 && <Body>Tekrarlar burada listelenir.</Body>}
        {[...counter.reps]
          .reverse()
          .slice(0, REPS_SHOWN)
          .map((rep, index) => {
            const faults = repFaults(rep, spec);
            return (
              <View key={counter.reps.length - index} style={styles.repRow}>
                <Text style={[styles.repNo, { color: rep.counted ? colors.lime : colors.muted }]}>{rep.counted ? rep.number : '-'}</Text>
                <Text style={styles.repAngle}>{`${Math.round(rep.minAngle)}°`}</Text>
                <Text style={styles.repTime}>{seconds(rep.liftMs)}</Text>
                <Text style={[styles.repFaults, { color: faults.length ? colors.bad : colors.ok }]} numberOfLines={2}>
                  {faults.length ? faults.map((fault) => faultText(fault, spec)).join(', ') : 'Temiz'}
                </Text>
              </View>
            );
          })}
      </Card>

      <Body style={{ fontSize: 12 }}>
        İskeleti Google'ın MediaPipe Pose modeli bu telefonda çıkarır; görüntü kaydedilmez ve hiçbir yere gönderilmez. Tekrar, derinlik ve kilitleme eklem açılarından sabit kurallarla hesaplanır.
      </Body>
    </View>
  );
}

function Metric({ label, value, hint, bad = false }: { label: string; value: string; hint: string; bad?: boolean }) {
  return (
    <View style={styles.metric}>
      <Label>{label.toLocaleUpperCase('tr-TR')}</Label>
      <Text style={[styles.metricValue, bad && { color: colors.bad }]}>{value}</Text>
      <Body style={{ fontSize: 11 }}>{hint}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { gap: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: colors.lime, borderColor: colors.lime },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  stage: { aspectRatio: 3 / 4, maxHeight: 520, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000', borderWidth: 1, borderColor: colors.line },
  webView: { flex: 1, backgroundColor: '#000' },
  cover: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl, backgroundColor: colors.ink },
  coverTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  coverError: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.bad, textAlign: 'center' },
  badges: { position: 'absolute', top: space.md, left: space.md, right: space.md, flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  badge: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text,
    backgroundColor: 'rgba(10,13,20,0.75)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  repBadge: { position: 'absolute', top: 44, right: space.md, alignItems: 'flex-end' },
  repCount: { fontFamily: fonts.display, fontSize: 56, color: colors.lime, lineHeight: 60 },
  repPartial: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.bad },
  tip: { position: 'absolute', left: space.md, right: space.md, bottom: space.md, borderRadius: radius.md, borderWidth: 1, backgroundColor: 'rgba(10,13,20,0.85)', padding: space.md },
  tipText: { fontFamily: fonts.display, fontSize: 17, textAlign: 'center' },
  controls: { flexDirection: 'row', gap: space.sm },
  control: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  controlText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  phases: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.line },
  phase: { flex: 1, textAlign: 'center', paddingVertical: 6, fontFamily: fonts.bodySemi, fontSize: 12, color: colors.muted, borderRadius: 10, overflow: 'hidden' },
  phaseActive: { backgroundColor: colors.surface2, color: colors.lime },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  metric: { flexBasis: '48%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.md, gap: 2 },
  metricValue: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  repRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 4 },
  repNo: { width: 22, fontFamily: fonts.mono, fontSize: 13 },
  repAngle: { width: 44, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  repTime: { width: 52, fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  repFaults: { flex: 1, textAlign: 'right', fontFamily: fonts.bodyMedium, fontSize: 12 },
});
