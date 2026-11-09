import { CalendarDays, ChevronRight, Clock } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PROGRAM_GOAL_TEXT, PROGRAM_LEVEL_TEXT, type ProgramSummary } from '../../../shared/contract';
import { Body, Label } from './components';
import { colors, fonts, radius, space } from './theme';

export function ProgramCard({ program, current, onPress }: { program: ProgramSummary; current?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, current && styles.current, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.top}>
        <Label style={{ color: colors.lime }}>{`${PROGRAM_GOAL_TEXT[program.goal]} · ${PROGRAM_LEVEL_TEXT[program.level]}`}</Label>
        {current ? <Text style={styles.currentBadge}>Şu anki programın</Text> : <ChevronRight size={18} color={colors.muted} />}
      </View>
      <Text style={styles.name}>{program.name}</Text>
      <Body numberOfLines={2}>{program.description}</Body>
      <View style={styles.meta}>
        <View style={styles.inline}>
          <CalendarDays size={14} color={colors.muted} />
          <Body>{`Haftada ${program.daysPerWeek} gün`}</Body>
        </View>
        <View style={styles.inline}>
          <Clock size={14} color={colors.muted} />
          <Body>{`${program.weeks} hafta`}</Body>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.lg, gap: space.sm },
  current: { borderColor: 'rgba(200,240,49,0.45)' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currentBadge: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.lime },
  name: { fontFamily: fonts.display, fontSize: 19, color: colors.text },
  meta: { flexDirection: 'row', gap: space.lg, marginTop: space.xs },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
