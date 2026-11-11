import { router } from 'expo-router';
import { ChevronRight, LogOut, Pencil, ShieldCheck, Wifi, WifiOff } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ACCOUNT_ROLE_TEXT, MEMBER_GENDER_TEXT, MEMBER_GOAL_TEXT } from '../../../../shared/contract';
import { apiUrl } from '@/lib/config';
import { useSession } from '@/lib/session';
import { Body, Button, Card, Initials, Label, Screen, Title } from '@/ui/components';
import { MEMBERSHIP_STATUS_TEXT, formatPhone, initials, longDate } from '@/ui/format';
import { colors, fonts, space } from '@/ui/theme';

export default function ProfileScreen() {
  const { session, me, liveConnected, signOut } = useSession();
  const member = me?.member ?? session?.member;
  if (!member) return null;
  const isTrainer = member.role === 'trainer';

  return (
    <Screen>
      <View style={styles.header}>
        <Initials text={initials(member.fullName)} size={64} highlight />
        <View style={{ flex: 1, gap: space.xs }}>
          <Title style={{ fontSize: 22 }}>{member.fullName}</Title>
          <Body>{formatPhone(member.phone)}</Body>
          {isTrainer && <Label style={{ color: colors.lime }}>{ACCOUNT_ROLE_TEXT.trainer}</Label>}
        </View>
      </View>

      {!isTrainer && (
        <Card>
          <View style={styles.row}>
            <Label>Bilgilerim</Label>
            <Pressable onPress={() => router.push('/profile-edit')} accessibilityRole="button" hitSlop={10} style={styles.inline}>
              <Pencil size={14} color={colors.lime} />
              <Text style={[styles.value, { color: colors.lime }]}>Düzenle</Text>
            </Pressable>
          </View>
          <Row label="Boy" value={member.heightCm ? `${member.heightCm} cm` : '-'} />
          <Row label="Kilo" value={member.weightKg ? `${member.weightKg} kg` : '-'} />
          <Row label="Doğum yılı" value={member.birthYear ? String(member.birthYear) : '-'} />
          <Row label="Cinsiyet" value={member.gender ? MEMBER_GENDER_TEXT[member.gender] : '-'} />
          <Row label="Hedef" value={member.goal ? MEMBER_GOAL_TEXT[member.goal] : '-'} />
        </Card>
      )}

      {me?.membership && (
        <Card>
          <Label>Üyelik</Label>
          <Row label="Paket" value={me.membership.planName} />
          <Row label="Durum" value={MEMBERSHIP_STATUS_TEXT[me.membership.status]} />
          <Row label="Başlangıç" value={longDate(me.membership.startsOn)} />
          <Row label="Bitiş" value={longDate(me.membership.endsOn)} />
        </Card>
      )}

      <Pressable onPress={() => router.push('/kvkk')} accessibilityRole="button">
        <Card>
          <View style={styles.row}>
            <View style={styles.inline}>
              <ShieldCheck size={18} color={colors.lime} />
              <View>
                <Text style={styles.value}>KVKK ve onaylarım</Text>
                <Body style={{ fontSize: 12 }}>Aydınlatma metni, verdiğin rızalar</Body>
              </View>
            </View>
            <ChevronRight size={18} color={colors.muted} />
          </View>
        </Card>
      </Pressable>

      <Card>
        <Label>Bağlantı</Label>
        <View style={styles.row}>
          <View style={styles.inline}>
            {liveConnected ? <Wifi size={16} color={colors.ok} /> : <WifiOff size={16} color={colors.muted} />}
            <Body>{liveConnected ? 'Canlı bağlantı açık' : 'Canlı bağlantı yok'}</Body>
          </View>
        </View>
        <Text style={styles.mono}>{apiUrl()}</Text>
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
