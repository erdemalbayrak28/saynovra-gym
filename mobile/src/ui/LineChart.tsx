import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors, fonts } from './theme';

const HEIGHT = 150;
const PAD_X = 14;
const PAD_Y = 18;

/** Minimal line chart: one series, first and last value labelled. */
export function LineChart({
  values,
  unit,
  labels,
  formatValue = String,
}: {
  values: number[];
  unit: string;
  labels: string[];
  formatValue?: (value: number) => string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (values.length === 1 ? width / 2 : PAD_X + (i * (width - PAD_X * 2)) / (values.length - 1));
  const y = (v: number) => PAD_Y + (1 - (v - min) / span) * (HEIGHT - PAD_Y * 2);
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const last = values[values.length - 1] ?? 0;
  const first = values[0] ?? 0;

  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {[0, 0.5, 1].map((t) => (
            <Line key={t} x1={0} x2={width} y1={PAD_Y + t * (HEIGHT - PAD_Y * 2)} y2={PAD_Y + t * (HEIGHT - PAD_Y * 2)} stroke={colors.line} strokeWidth={1} />
          ))}
          <Polyline points={points} fill="none" stroke={colors.lime} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          {values.map((v, i) => (
            <Circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 5 : 3.5} fill={colors.ink} stroke={colors.lime} strokeWidth={2} />
          ))}
        </Svg>
      )}
      <View style={styles.footer}>
        <Text style={styles.edge}>{`${labels[0] ?? ''}: ${formatValue(first)} ${unit}`}</Text>
        <Text style={[styles.edge, { color: colors.lime }]}>{`${labels[labels.length - 1] ?? ''}: ${formatValue(last)} ${unit}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  edge: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
});
