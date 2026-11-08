import * as Brightness from 'expo-brightness';
import { useFocusEffect } from 'expo-router';
import { RefreshCw, ShieldCheck, ShieldX } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  GATE_REASON_TEXT,
  GATE_STEP_SECONDS,
  createGateCode,
  gateStep,
  msUntilNextStep,
  type CheckinDto,
  type GateDirection,
} from '../../../../shared/contract';
import { gateSigner } from '@/lib/gate';
import { useSession } from '@/lib/session';
import { Body, Card, Label, Screen, Title } from '@/ui/components';
import { firstName } from '@/ui/format';
import { colors, fonts, radius, space } from '@/ui/theme';

const TICK_MS = 250;
/** How long the gate result stays above the code after the event arrives. */
const BANNER_MS = 3500;
const QR_SIZE = 236;

export default function QrScreen() {
  const { session, me, lastCheckin, liveConnected } = useSession();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  useFocusEffect(useMaxBrightness());

  const banner = lastCheckin && now - lastCheckin.receivedAt < BANNER_MS ? lastCheckin.checkin : null;

  const direction: GateDirection = me?.isInside ? 'out' : 'in';
  const step = gateStep(now);
  const signer = useMemo(() => (session ? gateSigner(session.qrSecret) : null), [session]);
  const code = useMemo(
    () => (session && signer ? createGateCode(session.member.id, direction, step * GATE_STEP_SECONDS * 1000, signer) : null),
    [session, signer, direction, step],
  );
  const secondsLeft = Math.ceil(msUntilNextStep(now) / 1000);
  const name = me?.member.fullName ?? session?.member.fullName ?? '';

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Label>Kapı geçişi</Label>
          <Title>{direction === 'in' ? 'Giriş QR kodu' : 'Çıkış QR kodu'}</Title>
        </View>
        <View style={[styles.liveBadge, { borderColor: liveConnected ? colors.ok : colors.muted }]}>
          <View style={[styles.liveDot, { backgroundColor: liveConnected ? colors.ok : colors.muted }]} />
          <Text style={[styles.liveText, { color: liveConnected ? colors.ok : colors.muted }]}>{liveConnected ? 'Canlı' : 'Bağlanıyor'}</Text>
        </View>
      </View>

      {banner ? <Result checkin={banner} /> : null}

      <Card style={styles.qrCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.name}>{name}</Text>
            <Body>
              {'Yön: '}
              <Text style={{ color: colors.lime, fontFamily: fonts.bodySemi }}>{direction === 'in' ? 'Giriş' : 'Çıkış'}</Text>
            </Body>
          </View>
          <Label style={{ color: colors.text }}>HMAC-SHA256</Label>
        </View>

        <View style={styles.qrFrame}>
          {code ? <QRCode value={code} size={QR_SIZE} color={colors.ink} backgroundColor="#FFFFFF" quietZone={12} ecl="M" /> : null}
        </View>

        <View style={styles.rowBetween}>
          <View style={styles.inline}>
            <RefreshCw size={14} color={colors.lime} />
            <Body>Kendiliğinden yenilenir</Body>
          </View>
          <Text style={styles.countdown}>{`${secondsLeft} sn`}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(secondsLeft / GATE_STEP_SECONDS) * 100}%` }]} />
        </View>
        <Text style={styles.codeText} numberOfLines={1}>
          {code}
        </Text>
      </Card>

      <Body style={{ textAlign: 'center' }}>
        Kodu kapıdaki kameraya tutun. Ekran görüntüsü 90 saniye sonra geçersiz olur.
      </Body>
    </Screen>
  );
}

function Result({ checkin }: { checkin: CheckinDto }) {
  const granted = checkin.result === 'granted';
  const who = checkin.member ? firstName(checkin.member.fullName) : '';
  const title = granted ? (checkin.direction === 'in' ? `Kapı açıldı. Hoş geldin, ${who}` : `Çıkış yapıldı. Görüşmek üzere, ${who}`) : 'Kapı açılmadı';
  const detail = granted ? 'Kayıt resepsiyona düştü.' : checkin.reason ? GATE_REASON_TEXT[checkin.reason] : '';
  const Icon = granted ? ShieldCheck : ShieldX;
  return (
    <Card style={{ borderColor: granted ? colors.ok : colors.bad, backgroundColor: granted ? colors.okSoft : colors.badSoft }}>
      <View style={styles.inline}>
        <Icon size={22} color={granted ? colors.ok : colors.bad} />
        <Text style={[styles.resultTitle, { color: granted ? colors.ok : colors.bad }]}>{title}</Text>
      </View>
      {detail ? <Body style={{ color: colors.text }}>{detail}</Body> : null}
    </Card>
  );
}

/** Full brightness while the code is on screen, so the gate camera reads it; restored on blur. */
function useMaxBrightness() {
  return useCallback(() => {
    let previous: number | null = null;
    let active = true;
    (async () => {
      try {
        if (!(await Brightness.isAvailableAsync())) return;
        previous = await Brightness.getBrightnessAsync();
        if (active) await Brightness.setBrightnessAsync(1);
      } catch {
        // Brightness is a convenience; the code is still readable without it.
      }
    })();
    return () => {
      active = false;
      if (previous !== null) Brightness.setBrightnessAsync(previous).catch(() => {});
    };
  }, []);
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  qrCard: { borderColor: colors.lime, borderWidth: 2, gap: space.lg },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  qrFrame: { alignSelf: 'center', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#FFFFFF', padding: 4 },
  countdown: { fontFamily: fonts.mono, fontSize: 15, color: colors.lime },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.ink, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.lime },
  codeText: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted, textAlign: 'center' },
  resultTitle: { fontFamily: fonts.bodyBold, fontSize: 16, flexShrink: 1 },
});
