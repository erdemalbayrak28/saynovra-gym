import { router } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { ConsentDto } from '../../../shared/contract';
import {
  KVKK_NOTICE_PARAGRAPHS,
  KVKK_NOTICE_TITLE,
  KVKK_NOTICE_VERSION,
  KVKK_TRAINER_NOTICE_PARAGRAPHS,
  KVKK_TRAINER_NOTICE_TITLE,
  KVKK_TRAINER_NOTICE_VERSION,
  OPTIONAL_DATA_TEXT,
  OPTIONAL_DATA_TITLE,
} from '../../../shared/consent';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useResource } from '@/lib/useResource';
import { Body, Card, Label, Screen, ScreenHeader } from '@/ui/components';
import { colors, fonts, space } from '@/ui/theme';

const stampFormat = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function consentText(consent: ConsentDto): string {
  if (consent.kind === 'notice') return 'Aydınlatma metnini okudum';
  return consent.granted ? 'İsteğe bağlı bilgilerime açık rıza verdim' : 'İsteğe bağlı bilgilerime rıza vermedim';
}

/** Read-only: the texts and the decisions on record. Changes go through reception. */
export default function KvkkScreen() {
  const consents = useResource(api.consents);
  const { session, me } = useSession();
  // Trainers were shown their own notice; the optional-data consent is a member matter.
  const isTrainer = (me?.member.role ?? session?.member.role) === 'trainer';
  const notice = isTrainer
    ? { title: KVKK_TRAINER_NOTICE_TITLE, paragraphs: KVKK_TRAINER_NOTICE_PARAGRAPHS, version: KVKK_TRAINER_NOTICE_VERSION }
    : { title: KVKK_NOTICE_TITLE, paragraphs: KVKK_NOTICE_PARAGRAPHS, version: KVKK_NOTICE_VERSION };

  return (
    <Screen refreshing={consents.loading} onRefresh={() => void consents.reload()}>
      <ScreenHeader label="Gizlilik" title="KVKK" onBack={() => router.back()} />

      <Card>
        <Label>Verdiğin onaylar</Label>
        {consents.error && <Body style={{ color: colors.bad }}>{consents.error}</Body>}
        {consents.data?.consents.length === 0 && <Body>Kayıtlı onay yok. Hesabın bu özellikten önce açılmış.</Body>}
        {consents.data?.consents.map((consent) => (
          <View key={`${consent.kind}-${consent.at}`} style={styles.row}>
            <ShieldCheck size={18} color={consent.granted ? colors.ok : colors.muted} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.value}>{consentText(consent)}</Text>
              <Body style={styles.meta}>
                {stampFormat.format(new Date(consent.at))} · sürüm {consent.version}
              </Body>
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <Label>{`Aydınlatma metni · ${notice.version}`}</Label>
        <Text style={styles.heading}>{notice.title}</Text>
        {notice.paragraphs.map((paragraph) => (
          <Body key={paragraph}>{paragraph}</Body>
        ))}
      </Card>

      {!isTrainer && (
        <Card>
          <Label>{OPTIONAL_DATA_TITLE}</Label>
          <Body>{OPTIONAL_DATA_TEXT}</Body>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.xs },
  value: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  heading: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.text },
  meta: { fontSize: 12 },
});
