import { StyleSheet, Text, View } from 'react-native';
import type { HourlyOccupancy } from '../../../shared/contract';
import { colors, fonts } from './theme';

const HEIGHT = 72;

/** Expected occupancy per hour; the current hour is lime, busy hours red, past hours dimmed. */
export function HourlyBars({ hours, currentHour }: { hours: HourlyOccupancy[]; currentHour: number }) {
  const max = Math.max(40, ...hours.map((h) => h.pct));
  return (
    <View style={styles.row} accessibilityLabel="Saatlik yoğunluk">
      {hours.map((h) => {
        const current = h.hour === currentHour;
        const past = h.hour < currentHour;
        const color = current ? colors.lime : h.pct >= 70 ? colors.bad : h.pct >= 40 ? colors.info : 'rgba(238,241,246,0.35)';
        return (
          <View key={h.hour} style={styles.column}>
            <View style={styles.track}>
              <View style={[styles.bar, { height: `${Math.max(3, (h.pct / max) * 100)}%`, backgroundColor: color, opacity: past ? 0.45 : 1 }]} />
            </View>
            {h.hour % 3 === 0 || current ? (
              <Text style={[styles.label, current && { color: colors.lime }]}>{String(h.hour).padStart(2, '0')}</Text>
            ) : (
              <Text style={styles.label}> </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  column: { flex: 1, alignItems: 'center', gap: 4 },
  track: { height: HEIGHT, width: '100%', justifyContent: 'flex-end', borderRadius: 4, backgroundColor: colors.ink, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 3 },
  label: { fontFamily: fonts.mono, fontSize: 9, color: colors.muted },
});
