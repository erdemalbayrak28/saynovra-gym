import { LogOut, Wifi, WifiOff } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { MemberGoal } from '../../../../shared/contract';
import { API_URL } from '@/lib/config';
import { useSession } from '@/lib/session';
import { Body, Button, Card, Initials, Label, Screen, Title } from '@/ui/components';
import { MEMBERSHIP_STATUS_TEXT, formatPhone, initials, longDate } from '@/ui/format';
import { colors, fonts, space } from '@/ui/theme';

const GOAL_TEXT: Record<MemberGoal, string> = {
  lose: 'Kilo vermek',
  gain: 'Kas kazanmak',
  fit: 'Formda kalmak',
  strength: 'Güç',
};

export default function ProfileScreen() {
  const { session, me, liveConnected, signOut } = useSession();
  const member = me?.member ?? session?.member;
  if (!member) return null;

  return (
    <Screen>
      <View style={styles.header}>
        <Initials text={initials(member.fullName)} size={64} highlight />
        <View style={{ flex: 1, gap: space.xs }}>
          <Title style={{ fontSize: 22 }}>{member.fullName}</Title>
          <Body>{formatPhone(member.phone)}</Body>
        </View>
      </View>

      <Card>
        <Label>Bilgilerim</Label>
        <Row label="Boy" value={member.heightCm ? `${member.heightCm} cm` : '-'} />
        <Row label="Kilo" value={member.weightKg ? `${member.weightKg} kg` : '-'} />
        <Row label="Doğum yılı" value={member.birthYear ? String(member.birthYear) : '-'} />
        <Row label="Hedef" value={member.goal ? GOAL_TEXT[member.goal] : '-'} />
      </Card>

      {me?.membership && (
        <Card>
          <Label>Üyelik</Label>
          <Row label="Paket" value={me.membership.planName} />
          <Row label="Durum" value={MEMBERSHIP_STATUS_TEXT[me.membership.status]} />
          <Row label="Başlangıç" value={longDate(me.membership.startsOn)} />
          <Row label="Bitiş" value={longDate(me.membership.endsOn)} />
        </Card>
      )}

      <Card>
        <Label>Bağlantı</Label>
        <View style={styles.row}>
          <View style={styles.inline}>
            {liveConnected ? <Wifi size={16} color={colors.ok} /> : <WifiOff size={16} color={colors.muted} />}
            <Body>{liveConnected ? 'Canlı bağlantı açık' : 'Canlı bağlantı yok'}</Body>
          </View>
        </View>
        <Text style={styles.mono}>{API_URL}</Text>
      </Card>

      <Button title="Çıkış yap" variant="danger" onPress={() => void signOut()} icon={<LogOut size={18} color={colors.bad} />} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Body>{label}</Body>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingTop: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  value: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  mono: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
});
