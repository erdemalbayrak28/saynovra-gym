import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Dumbbell, House, QrCode, UserRound } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/ui/theme';

const ICONS = { index: House, training: Dumbbell, qr: QrCode, profile: UserRound } as const;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.ink } }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Ana Sayfa' }} />
      <Tabs.Screen name="training" options={{ title: 'Antrenman' }} />
      <Tabs.Screen name="qr" options={{ title: 'QR Geçiş' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}

/** Mockup tab bar: the QR tab is the raised lime button in the middle. */
function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const title = descriptors[route.key]?.options.title ?? route.name;
        const Icon = ICONS[route.name as keyof typeof ICONS] ?? House;
        const isQr = route.name === 'qr';
        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        const tint = isQr ? colors.lime : focused ? colors.lime : colors.muted;

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={title}
            style={styles.item}
          >
            <View style={[isQr && styles.qrButton, isQr && focused && styles.qrButtonActive]}>
              <Icon size={isQr ? 22 : 20} color={isQr && focused ? colors.ink : tint} strokeWidth={2.2} />
            </View>
            <Text style={[styles.label, { color: tint }]}>{title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(18,22,31,0.97)',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
  },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  qrButton: {
    padding: 8,
    borderRadius: 14,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: 'rgba(200,240,49,0.35)',
    marginTop: -4,
  },
  qrButtonActive: { backgroundColor: colors.lime, borderColor: colors.lime },
  label: { fontFamily: fonts.bodySemi, fontSize: 11 },
});
