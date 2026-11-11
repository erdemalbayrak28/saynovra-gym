import { StyleSheet, Text, View } from 'react-native';
import type { ProgressWeek } from '../../../shared/contract';
import { Body, Card, Label } from './components';
import { shortDate } from './format';
import { colors, fonts, space } from './theme';

/** Weekly volume bars with the workout count on top; the member's progress screen and the trainer's view share it. */
export function WeeksCard({ weeks }: { weeks: ProgressWeek[] }) {
  const maxVolume = Math.max(1, ...weeks.map((w) => w.volumeKg));
  const thisWeek = weeks[weeks.length - 1];
  return (
    <Card>
      <View style={styles.rowBetween}>
        <Label>{`Son ${weeks.length} hafta`}</Label>
        <Body>{`Bu hafta ${thisWeek?.workouts ?? 0} antrenman`}</Body>
      </View>
      <View style={styles.bars}>
        {weeks.map((week, index) => {
          const current = index === weeks.length - 1;
          return (
            <View key={week.weekStart} style={styles.barColumn}>
              <Text style={styles.barCount}>{week.workouts}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height: `${Math.max(4, (week.volumeKg / maxVolume) * 100)}%`, backgroundColor: current ? colors.lime : 'rgba(200,240,49,0.35)' },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{shortDate(week.weekStart)}</Text>
            </View>
          );
        })}
      </View>
      <Body>Çubuk yüksekliği haftalık hacim (kilo × tekrar), üstteki sayı antrenman sayısı.</Body>
    </Card>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, height: 150 },
  barColumn: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barCount: { fontFamily: fonts.mono, fontSize: 11, color: colors.text },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', borderRadius: 8, backgroundColor: colors.surface2, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 8 },
  barLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted },
});
