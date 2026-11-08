import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/lib/api';
import { DEMO_ACCOUNT } from '@/lib/demo';
import { useSession } from '@/lib/session';
import { Body, Button, Label } from '@/ui/components';
import { colors, fonts, radius, space } from '@/ui/theme';

export default function LoginScreen() {
  const { signIn } = useSession();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!phone.trim() || !password) {
      setError('Telefon ve şifreyi girin');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(phone, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Giriş yapılamadı');
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.content}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>
              N<Text style={{ color: colors.lime }}>G</Text>
            </Text>
          </View>
          <Text style={styles.wordmark}>
            NOVRA <Text style={{ color: colors.lime }}>GYM</Text>
          </Text>
          <Label>Powered by SAYNOVRA</Label>
        </View>

        <View style={styles.form}>
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
            <Label>Şifre</Label>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Şifreniz"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
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
          <Button title="Giriş yap" onPress={submit} loading={busy} />
          <Pressable
            onPress={() => {
              setPhone(DEMO_ACCOUNT.phone);
              setPassword(DEMO_ACCOUNT.password);
              setError(null);
            }}
            disabled={busy}
            style={styles.demo}
          >
            <Body style={{ color: colors.lime }}>Demo hesabını doldur</Body>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.xxl },
  brand: { alignItems: 'center', gap: space.sm },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(200,240,49,0.4)',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  logoText: { fontFamily: fonts.display, fontSize: 26, color: colors.text, letterSpacing: -1 },
  wordmark: { fontFamily: fonts.display, fontSize: 28, color: colors.text, letterSpacing: -0.5 },
  form: { gap: space.lg },
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
  error: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.bad },
  demo: { alignItems: 'center', paddingVertical: space.sm },
});
