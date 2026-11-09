import { router, useFocusEffect } from 'expo-router';
import { Check, DoorOpen, MessageSquare, QrCode, Radio, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  GYM_SPOTS,
  MUSCLE_GROUP_TEXT,
  SPOT_NOTE_MAX,
  type GymSpot,
  type MuscleGroup,
  type SpotRequestDto,
  type SpotterPostDto,
} from '../../../../shared/contract';
import { ApiError, api } from '@/lib/api';
import { useLiveEvent, useSession } from '@/lib/session';
import { useResource } from '@/lib/useResource';
import { Body, Button, Card, Initials, Label, Pill, Screen, Title } from '@/ui/components';
import { minutesAgo } from '@/ui/format';
import { colors, fonts, radius, space } from '@/ui/theme';

const MUSCLES = Object.keys(MUSCLE_GROUP_TEXT) as MuscleGroup[];
const NOTE_IDEAS = ['Son iki set için spotter lazım', 'Aynı programı çalışan varsa beraber gidelim', 'Ağır sette emniyet için biri lazım'];

const openChat = (requestId: number) => router.push({ pathname: '/chat/[id]', params: { id: String(requestId) } });

export default function BuddyScreen() {
  const { session, clearBuddyAlert } = useSession();
  const radar = useResource(api.radar);
  const reload = radar.reload;
  const [filter, setFilter] = useState<MuscleGroup | 'all'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => clearBuddyAlert(), [clearBuddyAlert]));
  useLiveEvent((event) => {
    if (event.type === 'radar' || event.type === 'spot_request') void reload();
  });

  const act = async (key: string, task: (token: string) => Promise<unknown>) => {
    if (!session) return;
    setBusy(key);
    setError(null);
    try {
      await task(session.token);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'İşlem yapılamadı');
    } finally {
      setBusy(null);
    }
  };

  const data = radar.data;
  const posts = (data?.posts ?? []).filter((p) => filter === 'all' || p.muscleGroup === filter);

  return (
    <Screen refreshing={radar.loading && data !== null} onRefresh={() => void reload()}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Label>Salon içi</Label>
          <Title>Buddy radarı</Title>
        </View>
        {data?.inside && <Pill text={`Canlı · ${data.posts.length} ilan`} color={colors.ok} background={colors.okSoft} />}
      </View>

      {!data && radar.loading && <ActivityIndicator color={colors.lime} style={{ marginTop: space.xxl }} />}
      {radar.error && <Body style={{ color: colors.bad }}>{radar.error}</Body>}
      {error && <Body style={{ color: colors.bad }}>{error}</Body>}

      {data && !data.inside && (
        <Card>
          <View style={styles.inline}>
            <DoorOpen size={18} color={colors.muted} />
            <Text style={styles.cardTitle}>Radar salondakiler içindir</Text>
          </View>
          <Body>Kapıdan giriş yaptığında spotter arayan üyeleri görür, sen de ilan açabilirsin. Kim olduğun başkalarına yalnızca adın ve soyadının baş harfiyle görünür.</Body>
          <Button title="Giriş QR kodunu aç" onPress={() => router.navigate('/qr')} icon={<QrCode size={18} color={colors.ink} />} />
        </Card>
      )}

      {data?.inside && (
        <>
          {data.matches.map((match) => (
            <MatchCard key={match.id} match={match} myId={session?.member.id ?? 0} />
          ))}
          {data.incoming.map((request) => (
            <Card key={request.id} style={styles.highlight}>
              <View style={styles.inline}>
                <Initials text={request.from.initials} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{`${request.from.displayName} spot olmak istiyor`}</Text>
                  <Body>{`${request.location} · ${minutesAgo(request.createdAt)}`}</Body>
                </View>
              </View>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Button title="Kabul et" loading={busy === `accept-${request.id}`} onPress={() => void act(`accept-${request.id}`, (t) => api.actOnSpotRequest(t, request.id, 'accept'))} icon={<Check size={18} color={colors.ink} />} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Reddet" variant="ghost" disabled={busy !== null} onPress={() => void act(`decline-${request.id}`, (t) => api.actOnSpotRequest(t, request.id, 'decline'))} icon={<X size={18} color={colors.text} />} />
                </View>
              </View>
            </Card>
          ))}

          {data.matches.length === 0 && (
            <MyPostCard
              post={data.myPost}
              busy={busy === 'post'}
              onOpen={(input) => void act('post', (t) => api.openPost(t, input))}
              onClose={() => void act('post', (t) => api.closePost(t))}
            />
          )}

          {data.outgoing.map((request) => (
            <Card key={request.id}>
              <Body style={{ color: colors.text }}>{`${request.to.displayName} kişisine istek gönderdin, cevap bekleniyor.`}</Body>
              <Button title="Vazgeç" variant="ghost" loading={busy === `cancel-${request.id}`} onPress={() => void act(`cancel-${request.id}`, (t) => api.actOnSpotRequest(t, request.id, 'cancel'))} />
            </Card>
          ))}

          <View style={styles.chips}>
            {(['all', ...MUSCLES] as const).map((key) => (
              <Chip key={key} text={key === 'all' ? 'Tümü' : MUSCLE_GROUP_TEXT[key]} selected={filter === key} onPress={() => setFilter(key)} />
            ))}
          </View>

          {posts.length === 0 && <Body>Şu an bu grupta spotter arayan yok.</Body>}
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              busy={busy === `request-${post.id}`}
              onRequest={() => void act(`request-${post.id}`, (t) => api.sendSpotRequest(t, post.id))}
            />
          ))}
        </>
      )}
    </Screen>
  );
}

function MatchCard({ match, myId }: { match: SpotRequestDto; myId: number }) {
  const other = match.from.id === myId ? match.to : match.from;
  return (
    <Card style={{ borderColor: colors.ok, backgroundColor: colors.okSoft }}>
      <View style={styles.inline}>
        <Initials text={other.initials} size={40} highlight />
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.ok }]}>{`${other.displayName} ile eşleştin`}</Text>
          <Body style={{ color: colors.text }}>{`${match.location} · ${MUSCLE_GROUP_TEXT[match.muscleGroup]}`}</Body>
        </View>
      </View>
      <Button title="Mesajlar" onPress={() => openChat(match.id)} icon={<MessageSquare size={18} color={colors.ink} />} />
    </Card>
  );
}

function MyPostCard({
  post,
  busy,
  onOpen,
  onClose,
}: {
  post: SpotterPostDto | null;
  busy: boolean;
  onOpen: (input: { muscleGroup: MuscleGroup; location: GymSpot; note: string }) => void;
  onClose: () => void;
}) {
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('chest_back');
  const [location, setLocation] = useState<GymSpot>('Bench 1');
  const [note, setNote] = useState(NOTE_IDEAS[0] ?? '');

  if (post) {
    return (
      <Card style={styles.highlight}>
        <View style={styles.inline}>
          <Radio size={18} color={colors.lime} />
          <Text style={[styles.cardTitle, { color: colors.lime }]}>Radarda görünüyorsun</Text>
        </View>
        <Body style={{ color: colors.text }}>{`${post.location} · ${MUSCLE_GROUP_TEXT[post.muscleGroup]}`}</Body>
        {post.note ? <Body>{`"${post.note}"`}</Body> : null}
        <Button title="İlanı kapat" variant="ghost" loading={busy} onPress={onClose} />
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.cardTitle}>Spotter mı arıyorsun?</Text>
      <Body>İlan açınca salondaki diğer üyeler seni radarda görür ve spot isteği gönderebilir. Salondan çıkınca ilan kendiliğinden kapanır.</Body>
      <Label>Ne çalışıyorsun</Label>
      <View style={styles.chips}>
        {MUSCLES.map((key) => (
          <Chip key={key} text={MUSCLE_GROUP_TEXT[key]} selected={muscleGroup === key} onPress={() => setMuscleGroup(key)} />
        ))}
      </View>
      <Label>Neredesin</Label>
      <View style={styles.chips}>
        {GYM_SPOTS.map((spot) => (
          <Chip key={spot} text={spot} selected={location === spot} onPress={() => setLocation(spot)} />
        ))}
      </View>
      <Label>Not</Label>
      <TextInput
        value={note}
        onChangeText={setNote}
        maxLength={SPOT_NOTE_MAX}
        placeholder="Kısa bir not"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <View style={styles.chips}>
        {NOTE_IDEAS.map((idea) => (
          <Chip key={idea} text={idea} selected={note === idea} onPress={() => setNote(idea)} />
        ))}
      </View>
      <Button title="İlanı aç" loading={busy} onPress={() => onOpen({ muscleGroup, location, note: note.trim() })} icon={<Radio size={18} color={colors.ink} />} />
    </Card>
  );
}

function PostCard({ post, busy, onRequest }: { post: SpotterPostDto; busy: boolean; onRequest: () => void }) {
  const status = post.myRequest?.status;
  return (
    <Card>
      <View style={styles.inline}>
        <View>
          <Initials text={post.member.initials} size={44} />
          <View style={styles.onlineDot} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.inline}>
            <Text style={styles.cardTitle}>{post.member.displayName}</Text>
            <Text style={styles.spot}>{post.location}</Text>
          </View>
          <Text style={styles.muscle}>{MUSCLE_GROUP_TEXT[post.muscleGroup]}</Text>
          {post.enteredAt && <Body>{`${minutesAgo(post.enteredAt)} girdi`}</Body>}
        </View>
      </View>
      {post.note ? (
        <View style={styles.note}>
          <Body style={{ color: colors.text, fontStyle: 'italic' }}>{`"${post.note}"`}</Body>
        </View>
      ) : null}
      {status === 'accepted' && post.myRequest ? (
        <Button title="Mesajlar" onPress={() => openChat(post.myRequest?.id ?? 0)} icon={<MessageSquare size={18} color={colors.ink} />} />
      ) : status === 'pending' ? (
        <Button title="İstek gönderildi" variant="ghost" disabled onPress={() => {}} />
      ) : (
        <Button title="Spot isteği gönder" loading={busy} onPress={onRequest} />
      )}
    </Card>
  );
}

function Chip({ text, selected, onPress }: { text: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && { color: colors.ink }]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  row: { flexDirection: 'row', gap: space.md },
  highlight: { borderColor: 'rgba(200,240,49,0.45)' },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  spot: { fontFamily: fonts.mono, fontSize: 11, color: colors.lime, backgroundColor: colors.limeSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  muscle: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.info },
  note: { padding: space.md, borderRadius: radius.md, backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.line },
  onlineDot: { position: 'absolute', right: -2, bottom: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.ok, borderWidth: 2, borderColor: colors.surface },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  chipSelected: { backgroundColor: colors.lime, borderColor: colors.lime },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink,
    color: colors.text,
    paddingHorizontal: space.lg,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
});
