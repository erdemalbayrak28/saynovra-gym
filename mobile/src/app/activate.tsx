import { router } from 'expo-router';
import { KeyRound } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ACTIVATION_CODE_LENGTH, PASSWORD_MIN_LENGTH } from '../../../shared/contract';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Body, Button, Label, ScreenHeader } from '@/ui/components';
import { colors, fonts, radius, space } from '@/ui/theme';

/** Client-side checks only for quick feedback; the server validates everything again. */
function problem(phone: string, code: string, password: string, repeat: string): string | null {
  if (!phone.trim()) return 'Telefon numaranı gir';
  if (!new RegExp(`^\\d{${ACTIVATION_CODE_LENGTH}}$`).test(code)) return `Resepsiyondaki ${ACTIVATION_CODE_LENGTH} haneli kodu gir`;
  if (password.length < PASSWORD_MIN_LENGTH) return `Şifre en az ${PASSWORD_MIN_LENGTH} karakter olmalı`;
  if (password !== repeat) return 'Şifreler aynı değil';
  return null;
}

export default function ActivateScreen() {
  const { activate } = useSession();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const invalid = problem(phone, code, password, repeat);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // On success the session switches to signed in and the router leaves this screen.
      await activate(phone, code, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Etkinleştirilemedi');
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader label="İlk giriş" title="Hesabını etkinleştir" onBack={() => router.back()} />

          <View style={styles.intro}>
            <KeyRound size={20} color={colors.lime} />
            <Body style={{ flex: 1 }}>
              Resepsiyon kaydını açınca ekranda {ACTIVATION_CODE_LENGTH} haneli bir kod gösterir. Kodu ve kendi belirleyeceğin şifreyi gir; şifreni kimse görmez. Şifreni unutursan resepsiyondan yeni kod iste.
            </Body>
          </View>

          <View style={styles.field}>
            <Label>Telefon</Label>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="0555 000 00 00"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              style={styles.input}
              editable={!busy}
            />
          </View>
          <View style={styles.field}>
            <Label>Kod</Label>
            <TextInput
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, ACTIVATION_CODE_LENGTH))}
              placeholder={'0'.repeat(ACTIVATION_CODE_LENGTH)}
              placeholderTextColor={colors.line}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={ACTIVATION_CODE_LENGTH}
              style={[styles.input, styles.code]}
              editable={!busy}
              accessibilityLabel="Etkinleştirme kodu"
            />
          </View>
          <View style={styles.field}>
            <Label>Yeni şifre</Label>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={`En az ${PASSWORD_MIN_LENGTH} karakter`}
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              style={styles.input}
              editable={!busy}
            />
          </View>
          <View style={styles.field}>
            <Label>Şifre tekrar</Label>
            <TextInput
              value={repeat}
              onChangeText={setRepeat}
              placeholder="Aynı şifre"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              style={styles.input}
              editable={!busy}
              onSubmitEditing={submit}
            />
          </View>

          {error && (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          )}
          <Button title="Etkinleştir ve giriş yap" onPress={submit} loading={busy} />
          <Body style={styles.note}>Kod bir kez kullanılır ve 15 dakika geçerlidir. Yeni şifre belirleyince başka cihazlardaki eski oturumların kapanır.</Body>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { padding: space.xl, gap: space.lg },
  intro: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(200,240,49,0.3)',
    backgroundColor: colors.surface,
  },
  field: { gap: space.sm },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: space.lg,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  code: { height: 64, fontFamily: fonts.mono, fontSize: 30, letterSpacing: 12, textAlign: 'center' },
  error: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.bad },
  note: { fontSize: 12, textAlign: 'center' },
});
