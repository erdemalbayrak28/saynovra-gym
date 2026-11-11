import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { QrCode, ScanLine, UserRound, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/ui/theme';

const ICONS = { members: Users, 'coach-form': ScanLine, 'coach-qr': QrCode, 'coach-profile': UserRound } as const;

/** Trainer app: their members, the camera form coach, the gate code and the account. */
export default function CoachLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.ink } }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="members" options={{ title: 'Üyelerim' }} />
      <Tabs.Screen name="coach-form" options={{ title: 'AI Form' }} />
      <Tabs.Screen name="coach-qr" options={{ title: 'QR Geçiş' }} />
      <Tabs.Screen name="coach-profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}

function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const title = descriptors[route.key]?.options.title ?? route.name;
        const Icon = ICONS[route.name as keyof typeof ICONS] ?? Users;
        const tint = focused ? colors.lime : colors.muted;
        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Pressable key={route.key} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={title} style={styles.item}>
            <Icon size={20} color={tint} strokeWidth={2.2} />
            <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
              {title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: 'rgba(18,22,31,0.97)', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontFamily: fonts.bodySemi, fontSize: 11 },
});
