import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { qrKeyId, type CheckinDto, type LiveEvent, type MeResponse, type MemberProfile } from '../../../shared/contract';
import { ApiError, api } from './api';
import { LIVE_URL } from './config';
import { gateSigner } from './gate';
import { deleteSecure, readSecure, writeSecure } from './storage';

const STORAGE_KEY = 'novra.session.v1';
const MAX_BACKOFF_MS = 10_000;
const QR_SECRET_PATTERN = /^[0-9a-f]{64}$/;

/** Fingerprint of a stored gate key, compared with MeResponse.qrKeyId. */
export function storedKeyId(qrSecret: string): string {
  return qrKeyId(gateSigner(qrSecret));
}

export interface StoredSession {
  token: string;
  qrSecret: string;
  member: MemberProfile;
}

type Status = 'restoring' | 'signedOut' | 'signedIn';

export interface ReceivedCheckin {
  checkin: CheckinDto;
  /** Phone clock at arrival; used for display timing so server/phone clock drift does not matter. */
  receivedAt: number;
}

interface SessionValue {
  status: Status;
  session: StoredSession | null;
  me: MeResponse | null;
  meError: string | null;
  /** Latest gate event for this member, pushed live by the server. */
  lastCheckin: ReceivedCheckin | null;
  liveConnected: boolean;
  /** Something on the buddy radar needs the member's attention (a request, a message). */
  buddyAlert: boolean;
  clearBuddyAlert: () => void;
  /** Listen to every live event; returns the unsubscribe function. */
  subscribe: (listener: LiveListener) => () => void;
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

type LiveListener = (event: LiveEvent) => void;
const LIVE_TYPES = new Set<LiveEvent['type']>(['checkin', 'radar', 'spot_request', 'spot_message', 'floor', 'membership']);

const SessionContext = createContext<SessionValue | null>(null);

function parseStored(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof value.token !== 'string' || typeof value.qrSecret !== 'string' || !value.member) return null;
    return value as StoredSession;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('restoring');
  const [session, setSession] = useState<StoredSession | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [lastCheckin, setLastCheckin] = useState<ReceivedCheckin | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [buddyAlert, setBuddyAlert] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const sessionRef = useRef<StoredSession | null>(null);
  const listeners = useRef(new Set<LiveListener>());

  const subscribe = useCallback((listener: LiveListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);
  const clearBuddyAlert = useCallback(() => setBuddyAlert(false), []);

  const applySession = useCallback((next: StoredSession | null) => {
    sessionRef.current = next;
    tokenRef.current = next?.token ?? null;
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    applySession(null);
    setMe(null);
    setLastCheckin(null);
    setStatus('signedOut');
    await deleteSecure(STORAGE_KEY);
  }, [applySession]);

  // A reset demo database gives the member a new gate key while the token stays valid. Fetch the
  // new key instead of showing codes the gate will refuse as "Geçersiz kod".
  const syncQrKey = useCallback(
    async (token: string, serverKeyId: string) => {
      const current = sessionRef.current;
      if (!current || current.token !== token || storedKeyId(current.qrSecret) === serverKeyId) return;
      const key = await api.qrKey(token);
      if (!QR_SECRET_PATTERN.test(key.qrSecret) || storedKeyId(key.qrSecret) !== key.qrKeyId) {
        throw new ApiError(0, 'Kapı anahtarı doğrulanamadı, tekrar dene');
      }
      const latest = sessionRef.current;
      if (!latest || latest.token !== token) return; // Signed out meanwhile.
      const next: StoredSession = { ...latest, qrSecret: key.qrSecret };
      applySession(next);
      await writeSecure(STORAGE_KEY, JSON.stringify(next));
    },
    [applySession],
  );

  const refreshMe = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    try {
      const next = await api.me(token);
      setMe(next);
      setMeError(null);
      await syncQrKey(token, next.qrKeyId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await signOut();
        return;
      }
      setMeError(err instanceof ApiError ? err.message : 'Bilgiler alınamadı');
    }
  }, [signOut, syncQrKey]);

  const signIn = useCallback(
    async (phone: string, password: string) => {
      const result = await api.login(phone, password);
      const stored: StoredSession = { token: result.token, qrSecret: result.qrSecret, member: result.member };
      await writeSecure(STORAGE_KEY, JSON.stringify(stored));
      applySession(stored);
      setStatus('signedIn');
      await refreshMe();
    },
    [applySession, refreshMe],
  );

  // Restore a saved session once at startup.
  useEffect(() => {
    let cancelled = false;
    readSecure(STORAGE_KEY)
      .then(parseStored, () => null)
      .then((stored) => {
        if (cancelled) return;
        if (!stored) {
          setStatus('signedOut');
          return;
        }
        applySession(stored);
        setStatus('signedIn');
        void refreshMe();
      });
    return () => {
      cancelled = true;
    };
  }, [applySession, refreshMe]);

  // Live events for this member; reconnects with backoff while signed in.
  const token = session?.token ?? null;
  const memberId = session?.member.id ?? null;
  useEffect(() => {
    if (!token) return;
    let socket: WebSocket | null = null;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const connect = () => {
      socket = new WebSocket(`${LIVE_URL}?token=${encodeURIComponent(token)}`);
      socket.onopen = () => {
        attempt = 0;
        setLiveConnected(true);
      };
      socket.onmessage = (message) => {
        let event: LiveEvent;
        try {
          event = JSON.parse(String(message.data)) as LiveEvent;
        } catch {
          return;
        }
        if (!event || !LIVE_TYPES.has(event.type)) return;
        for (const listener of listeners.current) listener(event);

        if (event.type === 'spot_request' && event.request.status === 'pending' && event.request.to.id === memberId) setBuddyAlert(true);
        if (event.type === 'spot_request' && event.request.status === 'accepted' && event.request.from.id === memberId) setBuddyAlert(true);
        if (event.type === 'spot_message' && event.message.senderId !== memberId) setBuddyAlert(true);
        // Reception sold, froze or cancelled a package: the membership card and the QR screen follow at once.
        if (event.type === 'membership' && event.memberId === memberId) void refreshMe();
        if (event.type !== 'checkin') return;

        const checkin = event.checkin;
        setLastCheckin({ checkin, receivedAt: Date.now() });
        // A granted pass moves the presence sequence on; the QR screen needs it at once for the next code.
        setMe((current) =>
          current && checkin.result === 'granted'
            ? { ...current, isInside: checkin.direction === 'in', presenceSeq: checkin.id, gym: event.gym }
            : current,
        );
        void refreshMe();
      };
      socket.onclose = () => {
        setLiveConnected(false);
        if (stopped) return;
        timer = setTimeout(connect, Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt++));
      };
    };

    connect();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshMe();
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
      appState.remove();
      socket?.close();
    };
  }, [token, memberId, refreshMe]);

  const value = useMemo<SessionValue>(
    () => ({ status, session, me, meError, lastCheckin, liveConnected, buddyAlert, clearBuddyAlert, subscribe, signIn, signOut, refreshMe }),
    [status, session, me, meError, lastCheckin, liveConnected, buddyAlert, clearBuddyAlert, subscribe, signIn, signOut, refreshMe],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

/** Runs `handler` for every live event while the component is mounted. */
export function useLiveEvent(handler: LiveListener): void {
  const { subscribe } = useSession();
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => subscribe((event) => latest.current(event)), [subscribe]);
}
