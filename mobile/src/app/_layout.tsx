import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SessionProvider, useSession } from '@/lib/session';
import { colors } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden (fast refresh); nothing to do.
});

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.ink, card: colors.surface, text: colors.text, border: colors.line, primary: colors.lime },
};

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_500Medium,
  });
  const { status, session, me } = useSession();
  // Sessions saved before trainers existed carry no role: those are members.
  const role = me?.member.role ?? session?.member.role ?? 'member';
  const signedIn = status === 'signedIn';
  // A font failure falls back to system fonts rather than blocking the app.
  const ready = (fontsLoaded || fontError !== null) && status !== 'restoring';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink } }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={signedIn && role === 'member'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="programs" />
          <Stack.Screen name="program/[id]" />
          <Stack.Screen name="workout" options={{ gestureEnabled: false }} />
          <Stack.Screen name="progress" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="form" />
          <Stack.Screen name="profile-edit" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && role === 'trainer'}>
          <Stack.Screen name="(coach)" />
          <Stack.Screen name="trainee/[id]" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="kvkk" />
        </Stack.Protected>
        <Stack.Protected guard={status !== 'signedIn'}>
          <Stack.Screen name="login" />
          <Stack.Screen name="activate" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
