import { router } from 'expo-router';
import { CalendarDays, DoorOpen, Dumbbell, Play, QrCode, Radio, Users } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  OCCUPANCY_LEVEL_TEXT,
  type MembershipSummary,
  type MyTrainingResponse,
  type OccupancyResponse,
  type RadarResponse,
} from '../../../../shared/contract';
import { api } from '@/lib/api';
import { useLiveEvent, useSession } from '@/lib/session';
import { useResource } from '@/lib/useResource';
import { Body, Button, Card, Initials, Label, Pill, Screen, Title } from '@/ui/components';
import { MEMBERSHIP_STATUS_TEXT, firstName, hourLabel, initials, longDate } from '@/ui/format';
import { HourlyBars } from '@/ui/HourlyBars';
import { colors, fonts, space } from '@/ui/theme';

export default function HomeScreen() {
  const { session, me, meError, refreshMe } = useSession();
  const training = useResource(api.training);
  const occupancy = useResource(api.occupancy);
  const radar = useResource(api.radar);
  const reloadTraining = training.reload;
  const reloadOccupancy = occupancy.reload;
  const reloadRadar = radar.reload;
  const [refreshing, setRefreshing] = useState(false);

  useLiveEvent((event) => {
    if (event.type === 'radar') void reloadRadar();
    if (event.type === 'checkin') {
      void reloadOccupancy();
      void reloadRadar();
    }
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshMe(), reloadTraining(), reloadOccupancy(), reloadRadar()]);
    setRefreshing(false);
  }, [refreshMe, reloadTraining, reloadOccupancy, reloadRadar]);

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
      {training.data && <TodayCard training={training.data} />}
      {me && <PresenceCard inside={me.isInside} />}
      {radar.data?.inside && <BuddyPreview radar={radar.data} />}
      {occupancy.data && <OccupancyCard occupancy={occupancy.data} />}
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

function TodayCard({ training }: { training: MyTrainingResponse }) {
  const { enrollment, nextDay } = training;
  if (!enrollment || !nextDay) {
    return (
      <Card>
        <View style={styles.inline}>
          <Dumbbell size={16} color={colors.lime} />
          <Label style={{ color: colors.text }}>Antrenman</Label>
        </View>
        <Body>Henüz bir program seçmedin. Hedefine uygun programı seç, uygulama her gün ne yapacağını söylesin.</Body>
        <Button title="Program seç" variant="ghost" onPress={() => router.navigate('/training')} />
      </Card>
    );
  }
  return (
    <Card>
      <View style={styles.rowBetween}>
        <View style={styles.inline}>
          <Dumbbell size={16} color={colors.lime} />
          <Label style={{ color: colors.text }}>{training.activeWorkoutId ? 'Yarım kalan antrenman' : 'Sıradaki antrenman'}</Label>
        </View>
        <Body>{`Bu hafta ${training.weekWorkouts}`}</Body>
      </View>
      <Text style={styles.presenceText}>{nextDay.name}</Text>
      <Body>{`${nextDay.items.length} hareket · ~${nextDay.estimatedMinutes} dk · ${enrollment.program.name}`}</Body>
      <Button
        title={training.activeWorkoutId ? 'Devam et' : 'Antrenmana başla'}
        onPress={() => router.push('/workout')}
        icon={<Play size={18} color={colors.ink} fill={colors.ink} />}
      />
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

function BuddyPreview({ radar }: { radar: RadarResponse }) {
  const count = radar.posts.length;
  const first = radar.posts.slice(0, 2);
  return (
    <Card style={{ borderColor: 'rgba(77,184,255,0.4)' }}>
      <View style={styles.rowBetween}>
        <View style={styles.inline}>
          <Radio size={16} color={colors.info} />
          <Label style={{ color: colors.info }}>{'Salondaki buddy’ler'}</Label>
        </View>
        <Pill text={`${count} kişi`} color={colors.ok} background={colors.okSoft} />
      </View>
      {count === 0 ? (
        <Body>Şu an spotter arayan yok. İlan açarak sen arayabilirsin.</Body>
      ) : (
        first.map((post) => (
          <View key={post.id} style={styles.inline}>
            <Initials text={post.member.initials} size={34} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.presenceText} numberOfLines={1}>{`${post.member.displayName} · ${post.location}`}</Text>
              <Body numberOfLines={1}>{post.note || 'Spotter arıyor'}</Body>
            </View>
          </View>
        ))
      )}
      <Button title="Radarı aç" variant="ghost" onPress={() => router.navigate('/buddy')} icon={<Users size={18} color={colors.text} />} />
    </Card>
  );
}

const LEVEL_COLOR = { calm: colors.ok, normal: colors.info, busy: colors.bad } as const;

function OccupancyCard({ occupancy }: { occupancy: OccupancyResponse }) {
  const quiet = occupancy.quietestUpcoming;
  return (
    <Card>
      <View style={styles.rowBetween}>
        <View style={styles.inline}>
          <Users size={16} color={colors.lime} />
          <Label style={{ color: colors.text }}>Canlı doluluk</Label>
        </View>
        <Text style={[styles.levelText, { color: LEVEL_COLOR[occupancy.level] }]}>{OCCUPANCY_LEVEL_TEXT[occupancy.level]}</Text>
      </View>
      <View style={styles.daysRow}>
        <Text style={styles.occupancyNumber}>{occupancy.insideCount}</Text>
        <Body style={{ marginBottom: 6 }}>{`/ ${occupancy.capacity} kişi · %${occupancy.pct}`}</Body>
      </View>
      <HourlyBars hours={occupancy.hours} currentHour={occupancy.currentHour} />
      <Body>
        {`Çubuklar son 4 haftanın ${occupancy.weekdayName.toLocaleLowerCase('tr-TR')} günlerindeki ortalama doluluk.`}
        {quiet ? ` Bugün kalan saatlerde en sakin: ${hourLabel(quiet.hour)} (%${quiet.pct}).` : ''}
      </Body>
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
});
