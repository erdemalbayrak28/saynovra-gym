import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from './theme';

export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.lime} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Title({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.title, style]} />;
}

export function Body({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.body, style]} />;
}

/** Monospace uppercase tag, the brand's label style. */
export function Label({ style, children, ...props }: TextProps) {
  return (
    <Text {...props} style={[styles.label, style]}>
      {typeof children === 'string' ? children.toLocaleUpperCase('tr-TR') : children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        (pressed || inactive) && { opacity: inactive ? 0.5 : 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.ink : colors.text} />
      ) : (
        <View style={styles.buttonInner}>
          {icon}
          <Text style={[styles.buttonText, variant === 'primary' ? { color: colors.ink } : variant === 'danger' ? { color: colors.bad } : null]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function Initials({ text, size = 44, highlight = false }: { text: string; size?: number; highlight?: boolean }) {
  return (
    <View
      style={[
        styles.initials,
        { width: size, height: size, borderRadius: size * 0.32 },
        highlight ? { backgroundColor: colors.lime } : { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
      ]}
    >
      <Text style={[styles.initialsText, { fontSize: size * 0.34, color: highlight ? colors.ink : colors.lime }]}>{text}</Text>
    </View>
  );
}

export function Pill({ text, color, background }: { text: string; color: string; background: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: background, borderColor: color }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  scroll: { padding: space.lg, paddingBottom: 120, gap: space.lg },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.text, letterSpacing: -0.4 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.lg, gap: space.md },
  button: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  buttonPrimary: { backgroundColor: colors.lime },
  buttonGhost: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  buttonDanger: { backgroundColor: colors.badSoft, borderWidth: 1, borderColor: 'rgba(255,90,79,0.35)' },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  initials: { alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontFamily: fonts.display },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 12 },
});
