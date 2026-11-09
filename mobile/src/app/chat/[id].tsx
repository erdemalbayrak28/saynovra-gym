import { router, useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MUSCLE_GROUP_TEXT, SPOT_MESSAGE_MAX, type SpotMessageDto } from '../../../../shared/contract';
import { ApiError, api } from '@/lib/api';
import { useLiveEvent, useSession } from '@/lib/session';
import { useResource } from '@/lib/useResource';
import { Body, ScreenHeader } from '@/ui/components';
import { colors, fonts, radius, space } from '@/ui/theme';

const QUICK_REPLIES = ['İki dakikaya oradayım', 'Hazırım, gel', 'Son setteyim', 'Teşekkürler'];

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = Number(id);
  const { session } = useSession();
  const conversation = useResource((token) => api.chat(token, requestId));
  const reload = conversation.reload;
  const [live, setLive] = useState<SpotMessageDto[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);

  useLiveEvent((event) => {
    if (event.type === 'spot_message' && event.message.requestId === requestId) {
      setLive((current) => (current.some((m) => m.id === event.message.id) ? current : [...current, event.message]));
    }
    if (event.type === 'spot_request' && event.request.id === requestId) void reload();
  });

  const data = conversation.data;
  const myId = session?.member.id ?? 0;
  const known = new Set((data?.messages ?? []).map((m) => m.id));
  const messages = [...(data?.messages ?? []), ...live.filter((m) => !known.has(m.id))];
  const other = data ? (data.request.from.id === myId ? data.request.to : data.request.from) : null;

  const send = async (text: string) => {
    const body = text.trim();
    if (!session || !body) return;
    setSending(true);
    setError(null);
    try {
      const message = await api.sendMessage(session.token, requestId, body);
      setLive((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
      setDraft('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mesaj gönderilemedi');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.headerWrap}>
          <ScreenHeader
            label={data ? `Eşleşme · ${data.request.location} · ${MUSCLE_GROUP_TEXT[data.request.muscleGroup]}` : 'Eşleşme'}
            title={other?.displayName ?? ''}
            onBack={() => router.back()}
          />
        </View>

        <ScrollView ref={scroll} contentContainerStyle={styles.messages} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          {!data && conversation.loading && <ActivityIndicator color={colors.lime} style={{ marginTop: space.xxl }} />}
          {conversation.error && <Body style={{ color: colors.bad }}>{conversation.error}</Body>}
          {data && messages.length === 0 && <Body style={{ textAlign: 'center' }}>Eşleştiniz. Nerede buluşacağınızı yazın.</Body>}
          {messages.map((message) => {
            const mine = message.senderId === myId;
            return (
              <View key={message.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={styles.bubbleText}>{message.body}</Text>
              </View>
            );
          })}
        </ScrollView>

        {data && !data.canSend ? (
          <View style={styles.closed}>
            <Body style={{ textAlign: 'center' }}>Eşleşme sona erdi: biriniz salondan çıktı ya da istek kapandı.</Body>
          </View>
        ) : (
          <View style={styles.composer}>
            {error && <Body style={{ color: colors.bad }}>{error}</Body>}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick}>
              {QUICK_REPLIES.map((reply) => (
                <Pressable key={reply} onPress={() => void send(reply)} disabled={sending} style={styles.quickChip} accessibilityRole="button">
                  <Text style={styles.quickText}>{reply}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.inputRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Mesaj yaz"
                placeholderTextColor={colors.muted}
                maxLength={SPOT_MESSAGE_MAX}
                style={styles.input}
                onSubmitEditing={() => void send(draft)}
                editable={!sending}
              />
              <Pressable
                onPress={() => void send(draft)}
                disabled={sending || !draft.trim()}
                accessibilityRole="button"
                accessibilityLabel="Gönder"
                style={[styles.sendButton, (sending || !draft.trim()) && { opacity: 0.5 }]}
              >
                <Send size={20} color={colors.ink} />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  headerWrap: { paddingHorizontal: space.lg, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  messages: { padding: space.lg, gap: space.sm },
  bubble: { maxWidth: '80%', paddingHorizontal: space.md, paddingVertical: 10, borderRadius: radius.md },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.limeSoft, borderWidth: 1, borderColor: 'rgba(200,240,49,0.35)' },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.text },
  closed: { padding: space.lg, borderTopWidth: 1, borderTopColor: colors.line },
  composer: { gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  quick: { gap: space.sm },
  quickChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  quickText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.text },
  inputRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: {
    flex: 1,
    minWidth: 0,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink,
    color: colors.text,
    paddingHorizontal: space.lg,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  sendButton: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime },
});
