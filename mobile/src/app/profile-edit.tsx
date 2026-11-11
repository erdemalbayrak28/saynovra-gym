import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MEMBER_GENDER_TEXT, MEMBER_GOAL_TEXT, type MemberGender, type MemberGoal, type NewMemberProfile } from '../../../shared/contract';
import { KVKK_NOTICE_VERSION, OPTIONAL_DATA_TEXT, OPTIONAL_DATA_TITLE } from '../../../shared/consent';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Body, Button, Card, Label, Screen, ScreenHeader } from '@/ui/components';
import { colors, fonts, radius, space } from '@/ui/theme';

type Parsed = number | null | 'invalid';

/** Empty text is "not given"; anything else must be a number in range. The server checks again. */
function parse(text: string, min: number, max: number, integer: boolean): Parsed {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) return 'invalid';
  return value;
}

const text = (value: number | null) => (value === null ? '' : String(value).replace('.', ','));

/**
 * The optional profile fields. They are kept only with explicit consent: a member who gave none at
 * the desk confirms the consent text here first.
 */
export default function ProfileEditScreen() {
  const { session, me, refreshMe, signOut } = useSession();
  const member = me?.member ?? session?.member;
  const hasConsent = me?.optionalDataConsent ?? false;

  const [birthYear, setBirthYear] = useState(text(member?.birthYear ?? null));
  const [height, setHeight] = useState(text(member?.heightCm ?? null));
  const [weight, setWeight] = useState(text(member?.weightKg ?? null));
  const [gender, setGender] = useState<MemberGender | null>(member?.gender ?? null);
  const [goal, setGoal] = useState<MemberGoal | null>(member?.goal ?? null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = { birthYear: parse(birthYear, 1920, 2015, true), heightCm: parse(height, 120, 230, true), weightKg: parse(weight, 30, 250, false) };
  const invalid = Object.values(parsed).some((value) => value === 'invalid');
  const canSave = !invalid && (hasConsent || agreed);

  const save = async () => {
    if (!session || !canSave || parsed.birthYear === 'invalid' || parsed.heightCm === 'invalid' || parsed.weightKg === 'invalid') return;
    const profile: NewMemberProfile = { birthYear: parsed.birthYear, heightCm: parsed.heightCm, weightKg: parsed.weightKg, gender, goal };
    setBusy(true);
    setError(null);
    try {
      await api.updateProfile(session.token, { profile, consentVersion: hasConsent ? null : KVKK_NOTICE_VERSION });
      await refreshMe();
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await signOut();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Kaydedilemedi');
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen>
        <ScreenHeader label="Profil" title="Bilgilerim" onBack={() => router.back()} />
        <Body>Bu bilgiler isteğe bağlıdır; program ve ağırlık önerisi için kullanılır. Boş bıraktığın alan kaydedilmez.</Body>

        <Card>
          <Field label="Doğum yılı" value={birthYear} onChange={setBirthYear} placeholder="1994" hint={parsed.birthYear === 'invalid' ? '1920 ile 2015 arası' : null} maxLength={4} />
          <Field label="Boy (cm)" value={height} onChange={setHeight} placeholder="175" hint={parsed.heightCm === 'invalid' ? '120 ile 230 arası' : null} maxLength={3} />
          <Field label="Kilo (kg)" value={weight} onChange={setWeight} placeholder="72,5" hint={parsed.weightKg === 'invalid' ? '30 ile 250 arası' : null} maxLength={5} decimal />
        </Card>

        <Card>
          <Choice label="Cinsiyet" options={MEMBER_GENDER_TEXT} value={gender} onChange={setGender} />
          <Choice label="Hedef" options={MEMBER_GOAL_TEXT} value={goal} onChange={setGoal} />
        </Card>

        {!hasConsent && (
          <Pressable onPress={() => setAgreed((value) => !value)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
            <Card style={agreed ? styles.consentOn : undefined}>
              <View style={styles.consentRow}>
                <View style={[styles.box, agreed && styles.boxOn]}>{agreed && <Check size={14} color={colors.ink} />}</View>
                <Text style={styles.consentTitle}>{OPTIONAL_DATA_TITLE}</Text>
              </View>
              <Body style={{ fontSize: 12 }}>{OPTIONAL_DATA_TEXT}</Body>
              <Label>{`Metin sürümü ${KVKK_NOTICE_VERSION}`}</Label>
            </Card>
          </Pressable>
        )}

        {error && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}
        <Button title="Kaydet" onPress={() => void save()} loading={busy} disabled={!canSave} />
        {!hasConsent && !agreed && <Body style={{ fontSize: 12, textAlign: 'center' }}>Kaydetmek için açık rıza metnini onayla.</Body>}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Field(props: { label: string; value: string; onChange: (value: string) => void; placeholder: string; hint: string | null; maxLength: number; decimal?: boolean }) {
  return (
    <View style={{ gap: space.xs }}>
      <Label>{props.label}</Label>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={props.decimal ? 'decimal-pad' : 'number-pad'}
        maxLength={props.maxLength}
        style={[styles.input, props.hint !== null && { borderColor: colors.bad }]}
      />
      {props.hint !== null && <Text style={styles.hint}>{props.hint}</Text>}
    </View>
  );
}

function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: Record<T, string>; value: T | null; onChange: (value: T | null) => void }) {
  return (
    <View style={{ gap: space.sm }}>
      <Label>{label}</Label>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {(Object.entries(options) as [T, string][]).map(([key, title]) => {
          const selected = value === key;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(selected ? null : key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.chip, selected && styles.chipOn]}
            >
              <Text style={[styles.chipText, selected && { color: colors.ink }]}>{title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink,
    color: colors.text,
    paddingHorizontal: space.lg,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.bad },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink },
  chipOn: { backgroundColor: colors.lime, borderColor: colors.lime },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  consentOn: { borderColor: 'rgba(200,240,49,0.5)' },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  consentTitle: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.text },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.lime, borderColor: colors.lime },
  error: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.bad },
});
