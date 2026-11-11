import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MEMBERSHIP_STATUS_TEXT, type TrainerMemberItem } from '../../../../shared/contract';
import { api } from '@/lib/api';
import { useLiveEvent, useSession } from '@/lib/session';
import { useResource } from '@/lib/useResource';
import { Body, Card, Initials, Label, Screen, Title } from '@/ui/components';
import { firstName, minutesAgo, shortDate } from '@/ui/format';
import { colors, fonts, radius, space } from '@/ui/theme';

const DAY_MINUTES = 24 * 60;

function lastWorkoutText(iso: string | null): string {
  if (!iso) return 'Henüz antrenman yok';
  const minutes = (Date.now() - Date.parse(iso)) / 60000;
  return `Son antrenman ${minutes < DAY_MINUTES ? minutesAgo(iso) : shortDate(iso.slice(0, 10))}`;
}

/** The trainer's own members; those in the gym right now come first and update live. */
export default function TraineesScreen() {
  const { session } = useSession();
  const trainees = useResource(api.trainees);
  // A member walked in or out, got a programme, or reception changed who is assigned.
  useLiveEvent((event) => {
    if (event.type === 'checkin' || event.type === 'training') void trainees.reload();
  });

  const list = trainees.data ?? [];
  const inside = list.filter((member) => member.isInside);
  const outside = list.filter((member) => !member.isInside);

  return (
    <Screen refreshing={trainees.loading && trainees.data !== null} onRefresh={() => void trainees.reload()}>
      <View style={{ gap: space.xs, paddingTop: space.sm }}>
        <Label>{`Merhaba ${firstName(session?.member.fullName ?? '')}`}</Label>
        <Title>Üyelerim</Title>
      </View>

      {trainees.error && <Body style={{ color: colors.bad }}>{trainees.error}</Body>}
      {!trainees.data && trainees.loading && <ActivityIndicator color={colors.lime} style={{ marginTop: space.xxl }} />}

      {trainees.data && list.length === 0 && (
        <Card>
          <Text style={styles.name}>Henüz atanmış üyen yok</Text>
          <Body>Resepsiyon bir üyenin kartından seni eğitmen olarak atayınca üye burada görünür.</Body>
        </Card>
      )}

      {inside.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Label style={{ color: colors.ok }}>{`ŞU AN SALONDA · ${inside.length}`}</Label>
          {inside.map((member) => (
            <TraineeRow key={member.id} member={member} />
          ))}
        </View>
      )}
      {outside.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Label>{`DİĞER ÜYELER · ${outside.length}`}</Label>
          {outside.map((member) => (
            <TraineeRow key={member.id} member={member} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function TraineeRow({ member }: { member: TrainerMemberItem }) {
  const troubled = member.membershipStatus !== null && member.membershipStatus !== 'active';
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/trainee/[id]', params: { id: String(member.id) } })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, member.isInside && styles.rowInside, pressed && { opacity: 0.85 }]}
    >
      <Initials text={member.initials} highlight={member.isInside} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name} numberOfLines={1}>
          {member.fullName}
        </Text>
        <Body numberOfLines={1}>{member.programName ?? 'Programı yok'}</Body>
        <Body style={{ fontSize: 12 }} numberOfLines={1}>
          {`Bu hafta ${member.weekWorkouts} antrenman · ${lastWorkoutText(member.lastWorkoutAt)}`}
        </Body>
        {troubled && member.membershipStatus && <Text style={styles.status}>{`Üyelik: ${MEMBERSHIP_STATUS_TEXT[member.membershipStatus]}`}</Text>}
        {member.membershipStatus === null && <Text style={styles.status}>Üyeliği yok</Text>}
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  rowInside: { borderColor: 'rgba(46,229,157,0.35)' },
  name: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.text },
  status: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.bad },
});
