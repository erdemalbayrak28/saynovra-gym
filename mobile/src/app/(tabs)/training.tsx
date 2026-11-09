import { router } from 'expo-router';
import { ChartLine, Clock, Play, Repeat } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PROGRAM_GOAL_TEXT, PROGRAM_LEVEL_TEXT, type MyTrainingResponse, type ProgramDayDto } from '../../../../shared/contract';
import { api } from '@/lib/api';
import { useResource } from '@/lib/useResource';
import { Body, Button, Card, Label, Pill, Screen, Title } from '@/ui/components';
import { ProgramCard } from '@/ui/ProgramCard';
import { setsText } from '@/ui/format';
import { colors, fonts, space } from '@/ui/theme';

export default function TrainingScreen() {
  const training = useResource(api.training);
  const programs = useResource(api.programs);
  const data = training.data;

  return (
    <Screen refreshing={training.loading && data !== null} onRefresh={() => void training.reload()}>
      <View style={{ gap: space.xs, paddingTop: space.sm }}>
        <Label>Antrenman</Label>
        <Title>{data?.enrollment ? 'Bugün ne yapıyoruz?' : 'Bir program seç'}</Title>
      </View>

      {training.error && (
        <Card style={{ borderColor: 'rgba(255,90,79,0.35)', backgroundColor: colors.badSoft }}>
          <Body style={{ color: colors.bad }}>{training.error}</Body>
        </Card>
      )}
      {!data && training.loading && <ActivityIndicator color={colors.lime} style={{ marginTop: space.xxl }} />}

      {data?.enrollment && data.nextDay ? (
        <EnrolledView data={data} nextDay={data.nextDay} />
      ) : data ? (
        <>
          <Body>Hedefine uygun programı seç; uygulama her antrenmanda ne yapacağını, kaç set ve kaç kiloyla yapacağını söyler.</Body>
          {(programs.data ?? []).map((program) => (
            <ProgramCard key={program.id} program={program} onPress={() => router.push({ pathname: '/program/[id]', params: { id: String(program.id) } })} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function EnrolledView({ data, nextDay }: { data: MyTrainingResponse; nextDay: ProgramDayDto }) {
  const enrollment = data.enrollment;
  if (!enrollment) return null;
  const resuming = data.activeWorkoutId !== null;

  return (
    <>
      <Card style={styles.nextCard}>
        <View style={styles.rowBetween}>
          <Label style={{ color: colors.lime }}>{`Sıradaki · Gün ${nextDay.dayIndex}/${enrollment.program.dayCount}`}</Label>
          <View style={styles.inline}>
            <Clock size={14} color={colors.muted} />
            <Body>{`~${nextDay.estimatedMinutes} dk`}</Body>
          </View>
        </View>
        <Text style={styles.dayName}>{nextDay.name}</Text>
        <Body>{nextDay.focus}</Body>
        <View style={styles.list}>
          {nextDay.items.map((item, index) => (
            <View key={item.id} style={styles.listRow}>
              <Text style={styles.index}>{index + 1}</Text>
              <Text style={styles.exercise} numberOfLines={1}>
                {item.exercise.name}
              </Text>
              <Text style={styles.sets}>{setsText(item.targetSets, item.repMin, item.repMax)}</Text>
            </View>
          ))}
        </View>
        <Button
          title={resuming ? 'Antrenmana devam et' : 'Antrenmana başla'}
          onPress={() => router.push('/workout')}
          icon={<Play size={18} color={colors.ink} fill={colors.ink} />}
        />
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Label>Programın</Label>
          <Pill text={`Bu hafta ${data.weekWorkouts}`} color={colors.lime} background={colors.limeSoft} />
        </View>
        <Text style={styles.programName}>{enrollment.program.name}</Text>
        <Body>{`${PROGRAM_GOAL_TEXT[enrollment.program.goal]} · ${PROGRAM_LEVEL_TEXT[enrollment.program.level]} · haftada ${enrollment.program.daysPerWeek} gün`}</Body>
        <Body>{`${enrollment.completedWorkouts} antrenman tamamlandı`}</Body>
        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <Button title="Gelişimim" variant="ghost" onPress={() => router.push('/progress')} icon={<ChartLine size={18} color={colors.text} />} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Değiştir" variant="ghost" onPress={() => router.push('/programs')} icon={<Repeat size={18} color={colors.text} />} />
          </View>
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  nextCard: { borderColor: 'rgba(200,240,49,0.4)' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayName: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  programName: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  list: { gap: 10, marginVertical: space.xs },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  index: { fontFamily: fonts.mono, fontSize: 12, color: colors.lime, width: 16 },
  exercise: { flex: 1, minWidth: 0, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  sets: { fontFamily: fonts.mono, fontSize: 13, color: colors.muted },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.xs },
});
