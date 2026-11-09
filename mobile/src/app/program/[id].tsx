import { router, useLocalSearchParams } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PROGRAM_GOAL_TEXT, PROGRAM_LEVEL_TEXT } from '../../../../shared/contract';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useResource } from '@/lib/useResource';
import { Body, Button, Card, Label, Screen, ScreenHeader } from '@/ui/components';
import { setsText } from '@/ui/format';
import { colors, fonts, space } from '@/ui/theme';

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const programId = Number(id);
  const { session } = useSession();
  const program = useResource((token) => api.program(token, programId));
  const training = useResource(api.training);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detail = program.data;
  const isCurrent = training.data?.enrollment?.program.id === programId;

  const start = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await api.enroll(session.token, programId);
      router.dismissTo('/training');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Program başlatılamadı');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader label="Program" title={detail?.name ?? ''} onBack={() => router.back()} />
      {!detail && program.loading && <ActivityIndicator color={colors.lime} style={{ marginTop: space.xxl }} />}
      {program.error && <Body style={{ color: colors.bad }}>{program.error}</Body>}

      {detail && (
        <>
          <Card>
            <Label style={{ color: colors.lime }}>{`${PROGRAM_GOAL_TEXT[detail.goal]} · ${PROGRAM_LEVEL_TEXT[detail.level]}`}</Label>
            <Body style={{ color: colors.text }}>{detail.description}</Body>
            <Body>{`Haftada ${detail.daysPerWeek} gün · ${detail.weeks} hafta · ${detail.dayCount} farklı antrenman sırayla`}</Body>
          </Card>

          {detail.days.map((day) => (
            <Card key={day.id}>
              <View style={styles.rowBetween}>
                <Label>{`Gün ${day.dayIndex}`}</Label>
                <View style={styles.inline}>
                  <Clock size={14} color={colors.muted} />
                  <Body>{`~${day.estimatedMinutes} dk`}</Body>
                </View>
              </View>
              <Text style={styles.dayName}>{day.name}</Text>
              {day.items.map((item) => (
                <View key={item.id} style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exercise}>{item.exercise.name}</Text>
                    <Body numberOfLines={1}>{item.exercise.muscleGroup}</Body>
                  </View>
                  <Text style={styles.sets}>{setsText(item.targetSets, item.repMin, item.repMax)}</Text>
                </View>
              ))}
            </Card>
          ))}

          {error && <Body style={{ color: colors.bad }}>{error}</Body>}
          {isCurrent ? (
            <Body style={{ textAlign: 'center', color: colors.lime }}>Şu an bu programdasın.</Body>
          ) : (
            <Button title="Bu programla başla" onPress={start} loading={busy} />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayName: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 4 },
  exercise: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  sets: { fontFamily: fonts.mono, fontSize: 13, color: colors.muted },
});
