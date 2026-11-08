import { router } from 'expo-router';
import { CalendarDays, DoorOpen, QrCode, Users } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { GymStatus, MembershipSummary } from '../../../../shared/contract';
import { useSession } from '@/lib/session';
import { Body, Button, Card, Initials, Label, Pill, Screen, Title } from '@/ui/components';
import { MEMBERSHIP_STATUS_TEXT, firstName, initials, longDate } from '@/ui/format';
import { colors, fonts, radius, space } from '@/ui/theme';

export default function HomeScreen() {
  const { session, me, meError, refreshMe } = useSession();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshMe();
    setRefreshing(false);
  }, [refreshMe]);

  const fullName = me?.member.fullName ?? session?.member.fullName ?? '';

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Label>Hoş geldin</Label>
          <Title>{firstName(fullName)}</Title>
        </View>
        <View>
          <Initials text={initials(fullName)} />
          <View style={[styles.presenceDot, { backgroundColor: me?.isInside ? colors.ok : colors.muted }]} />
        </View>
      </View>

      {meError && (
        <Card style={{ borderColor: 'rgba(255,90,79,0.35)', backgroundColor: colors.badSoft }}>
          <Body style={{ color: colors.bad }}>{meError}</Body>
        </Card>
      )}

      {me && <MembershipCard membership={me.membership} />}
      {me && <PresenceCard inside={me.isInside} />}
      {me && <OccupancyCard gym={me.gym} />}
    </Screen>
  );
}

function MembershipCard({ membership }: { membership: MembershipSummary | null }) {
  if (!membership) {
    return (
      <Card>
        <Label>Üyelik</Label>
        <Title style={{ fontSize: 20 }}>Aktif üyelik yok</Title>
        <Body>Paket almak için resepsiyona uğrayın.</Body>
      </Card>
    );
  }
  const active = membership.status === 'active';
  return (
    <Card style={active ? styles.membershipActive : undefined}>
      <View style={styles.rowBetween}>
        <Label>{`${membership.planName} üyelik`}</Label>
        <Pill
          text={MEMBERSHIP_STATUS_TEXT[membership.status]}
          color={active ? colors.lime : colors.bad}
          background={active ? colors.limeSoft : colors.badSoft}
        />
      </View>
      <View style={styles.daysRow}>
        <Text style={styles.daysNumber}>{membership.daysLeft}</Text>
        <Body style={{ marginBottom: 10 }}>{membership.daysLeft === 0 ? 'bugün son gün' : 'gün kaldı'}</Body>
      </View>
      <View style={styles.inline}>
        <CalendarDays size={16} color={colors.muted} />
        <Body>{`Bitiş: ${longDate(membership.endsOn)}`}</Body>
      </View>
    </Card>
  );
}

function PresenceCard({ inside }: { inside: boolean }) {
  return (
    <Card style={inside ? { borderColor: 'rgba(46,229,157,0.4)', backgroundColor: colors.okSoft } : undefined}>
      <View style={styles.inline}>
        <DoorOpen size={18} color={inside ? colors.ok : colors.muted} />
        <Text style={[styles.presenceText, { color: inside ? colors.ok : colors.text }]}>
          {inside ? 'Şu an salondasın' : 'Salon dışındasın'}
        </Text>
      </View>
      <Button
        title={inside ? 'Çıkış QR kodunu aç' : 'Giriş QR kodunu aç'}
        onPress={() => router.navigate('/qr')}
        icon={<QrCode size={18} color={colors.ink} />}
      />
    </Card>
  );
}

function OccupancyCard({ gym }: { gym: GymStatus }) {
  const percent = Math.min(100, Math.round((gym.insideCount / gym.capacity) * 100));
  const level = percent < 40 ? { text: 'Sakin', color: colors.ok } : percent < 70 ? { text: 'Normal', color: colors.info } : { text: 'Yoğun', color: colors.bad };
  return (
    <Card>
      <View style={styles.rowBetween}>
        <View style={styles.inline}>
          <Users size={16} color={colors.lime} />
          <Label style={{ color: colors.text }}>Canlı doluluk</Label>
        </View>
        <Text style={[styles.levelText, { color: level.color }]}>{level.text}</Text>
      </View>
      <View style={styles.daysRow}>
        <Text style={styles.occupancyNumber}>{gym.insideCount}</Text>
        <Body style={{ marginBottom: 6 }}>{`/ ${gym.capacity} kişi · %${percent}`}</Body>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: level.color }]} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm },
  presenceDot: { position: 'absolute', right: -2, bottom: -2, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.ink },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  membershipActive: { borderColor: 'rgba(200,240,49,0.35)' },
  daysRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  daysNumber: { fontFamily: fonts.display, fontSize: 56, lineHeight: 60, color: colors.lime, letterSpacing: -1.5 },
  occupancyNumber: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, color: colors.text },
  presenceText: { fontFamily: fonts.bodySemi, fontSize: 16 },
  levelText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  track: { height: 8, borderRadius: radius.sm, backgroundColor: colors.surface2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.sm },
});
