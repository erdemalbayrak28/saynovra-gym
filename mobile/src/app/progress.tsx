import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { useResource } from '@/lib/useResource';
import { Body, Card, Label, Screen, ScreenHeader } from '@/ui/components';
import { kg, shortDate } from '@/ui/format';
import { LineChart } from '@/ui/LineChart';
import { WeeksCard } from '@/ui/WeeksCard';
import { colors, fonts, radius, space } from '@/ui/theme';

export default function ProgressScreen() {
  const overview = useResource(api.progress);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const exercises = overview.data?.exercises ?? [];
  const activeId = selectedId ?? exercises[0]?.exerciseId ?? null;

  return (
    <Screen>
      <ScreenHeader label="Antrenman" title="Gelişimim" onBack={() => router.back()} />
      {overview.error && <Body style={{ color: colors.bad }}>{overview.error}</Body>}
      {!overview.data && overview.loading && <ActivityIndicator color={colors.lime} style={{ marginTop: space.xxl }} />}

      {overview.data && (
        <>
          <WeeksCard weeks={overview.data.weeks} />
          {activeId !== null && <ExerciseChart key={activeId} exerciseId={activeId} />}
          <Card>
            <Label>Hareketler</Label>
            {exercises.length === 0 && <Body>Henüz tamamlanmış antrenman yok.</Body>}
            {exercises.map((exercise) => {
              const selected = exercise.exerciseId === activeId;
              return (
                <Pressable
                  key={exercise.exerciseId}
                  onPress={() => setSelectedId(exercise.exerciseId)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.row, selected && styles.rowSelected]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{exercise.name}</Text>
                    <Body>{`${exercise.sessions} antrenman`}</Body>
                  </View>
                  <Text style={styles.rowValue}>{exercise.bestWeightKg === null ? 'Vücut ağırlığı' : `${kg(exercise.bestWeightKg)} kg`}</Text>
                </Pressable>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

function ExerciseChart({ exerciseId }: { exerciseId: number }) {
  const detail = useResource((token) => api.exerciseProgress(token, exerciseId));
  const data = detail.data;
  if (!data) return <Card>{detail.loading ? <ActivityIndicator color={colors.lime} /> : <Body>{detail.error}</Body>}</Card>;

  const byWeight = !data.exercise.isBodyweight;
  const values = data.points.map((p) => (byWeight ? (p.topWeightKg ?? 0) : p.topReps));
  return (
    <Card>
      <Label style={{ color: colors.lime }}>{byWeight ? 'En yüksek ağırlık' : 'En çok tekrar'}</Label>
      <Text style={styles.chartTitle}>{data.exercise.name}</Text>
      <LineChart values={values} unit={byWeight ? 'kg' : 'tekrar'} labels={data.points.map((p) => shortDate(p.date))} formatValue={kg} />
    </Card>
  );
}

const styles = StyleSheet.create({
  chartTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md },
  rowSelected: { backgroundColor: colors.limeSoft },
  rowName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  rowValue: { fontFamily: fonts.mono, fontSize: 13, color: colors.lime },
});
