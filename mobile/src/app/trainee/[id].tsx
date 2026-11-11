import { router, useLocalSearchParams } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { MEMBERSHIP_STATUS_TEXT, MEMBER_GOAL_TEXT, type ProgramSummary, type TrainerMemberDetail } from '../../../../shared/contract';
import { ApiError, api } from '@/lib/api';
import { useLiveEvent, useSession } from '@/lib/session';
import { useResource } from '@/lib/useResource';
import { Body, Button, Card, Initials, Label, Pill, Screen, ScreenHeader } from '@/ui/components';
import { kg, shortDate } from '@/ui/format';
import { ProgramCard } from '@/ui/ProgramCard';
import { WeeksCard } from '@/ui/WeeksCard';
import { colors, fonts, space } from '@/ui/theme';

/** One of the trainer's members: programme, progress, recent workouts, and assigning a programme. */
export default function TraineeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = Number(id);
  const { session, signOut } = useSession();
  const detail = useResource((token) => api.trainee(token, memberId));
  const programs = useResource(api.programs);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown straight from the assign response, before the next refetch.
  const [assigned, setAssigned] = useState<TrainerMemberDetail | null>(null);

  useLiveEvent((event) => {
    const changed = (event.type === 'training' && event.memberId === memberId) || (event.type === 'checkin' && event.checkin.member?.id === memberId);
    if (changed) {
      setAssigned(null);
      void detail.reload();
    }
  });

  const data = assigned ?? detail.data;

  const assign = async (program: ProgramSummary) => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      setAssigned(await api.assignProgram(session.token, memberId, program.id));
      setPicking(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await signOut();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Program atanamadı');
    } finally {
      setBusy(false);
    }
  };

  const confirmAssign = (program: ProgramSummary) => {
    if (!data) return;
    Alert.alert('Program ata', `${data.member.fullName} için "${program.name}" 1. günden başlasın mı? Geçmiş antrenmanları ve gelişimi korunur.`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Ata', onPress: () => void assign(program) },
    ]);
  };

  return (
    <Screen refreshing={detail.loading && detail.data !== null} onRefresh={() => void detail.reload()}>
      <ScreenHeader label="Üyem" title={data?.member.fullName ?? ''} onBack={() => router.back()} />
      {detail.error && !data && <Body style={{ color: colors.bad }}>{detail.error}</Body>}
      {!data && detail.loading && <ActivityIndicator color={colors.lime} style={{ marginTop: space.xxl }} />}

      {data && (
        <>
          <Card>
            <View style={styles.row}>
              <Initials text={data.member.initials} size={52} highlight={data.member.isInside} />
              <View style={{ flex: 1, gap: space.xs }}>
                <Pill
                  text={data.member.isInside ? 'Şu an salonda' : 'Salonda değil'}
                  color={data.member.isInside ? colors.ok : colors.muted}
                  background={data.member.isInside ? colors.okSoft : colors.surface2}
                />
                <Body>
                  {`Üyelik: ${data.member.membershipStatus ? MEMBERSHIP_STATUS_TEXT[data.member.membershipStatus] : 'yok'}${data.goal ? ` · Hedef: ${MEMBER_GOAL_TEXT[data.goal]}` : ''}`}
                </Body>
                {(data.heightCm !== null || data.weightKg !== null) && (
                  <Body>{[data.heightCm !== null ? `${data.heightCm} cm` : null, data.weightKg !== null ? `${kg(data.weightKg)} kg` : null].filter(Boolean).join(' · ')}</Body>
                )}
              </View>
            </View>
          </Card>

          <Card>
            <View style={styles.rowBetween}>
              <Label>Programı</Label>
              {data.enrollment?.assignedBy && <Pill text="Eğitmen atadı" color={colors.info} background={colors.infoSoft} />}
            </View>
            {data.enrollment ? (
              <>
                <Text style={styles.title}>{data.enrollment.program.name}</Text>
                <Body>{`${data.enrollment.completedWorkouts} antrenman tamamlandı · ${shortDate(data.enrollment.startedAt.slice(0, 10))} tarihinde başladı`}</Body>
                {!data.enrollment.assignedBy && <Body>Bu programı üye kendisi seçti.</Body>}
                {data.nextDay && <Body style={{ color: colors.text }}>{`Sıradaki: ${data.nextDay.name} (${data.nextDay.items.length} hareket)`}</Body>}
              </>
            ) : (
              <Body>Üyenin programı yok. Aşağıdan bir program atayabilirsin.</Body>
            )}
            {data.activeWorkout && <Body style={{ color: colors.info }}>Şu an antrenmanda; antrenman bitmeden program değiştirilemez.</Body>}
            {error && (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            )}
            <Button
              title={picking ? 'Vazgeç' : data.enrollment ? 'Programı değiştir' : 'Program ata'}
              variant={picking ? 'ghost' : 'primary'}
              onPress={() => setPicking((open) => !open)}
              disabled={busy || data.activeWorkout}
              icon={picking ? undefined : <ClipboardList size={18} color={colors.ink} />}
            />
          </Card>

          {picking && (
            <View style={{ gap: space.sm }}>
              <Label>Program kütüphanesi</Label>
              {programs.error && <Body style={{ color: colors.bad }}>{programs.error}</Body>}
              {!programs.data && programs.loading && <ActivityIndicator color={colors.lime} />}
              {(programs.data ?? []).map((program) => (
                <ProgramCard key={program.id} program={program} current={program.id === data.enrollment?.program.id} onPress={() => confirmAssign(program)} />
              ))}
            </View>
          )}

          <WeeksCard weeks={data.progress.weeks} />

          <Card>
            <Label>Son antrenmanlar</Label>
            {data.recentWorkouts.length === 0 && <Body>Henüz tamamlanmış antrenman yok.</Body>}
            {data.recentWorkouts.map((workout) => (
              <View key={workout.id} style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{workout.dayName}</Text>
                  <Body>{`${shortDate(workout.finishedAt.slice(0, 10))} · ${workout.sets} set`}</Body>
                </View>
                <Text style={styles.value}>{`${workout.volumeKg.toLocaleString('tr-TR')} kg`}</Text>
              </View>
            ))}
          </Card>

          <Card>
            <Label>Hareket başına en yüksek</Label>
            {data.progress.exercises.length === 0 && <Body>Kayıt yok.</Body>}
            {data.progress.exercises.map((exercise) => (
              <View key={exercise.exerciseId} style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{exercise.name}</Text>
                  <Body>{`${exercise.sessions} antrenman`}</Body>
                </View>
                <Text style={styles.value}>{exercise.bestWeightKg === null ? 'Vücut ağırlığı' : `${kg(exercise.bestWeightKg)} kg`}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  name: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  value: { fontFamily: fonts.mono, fontSize: 13, color: colors.lime },
  error: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.bad },
});
