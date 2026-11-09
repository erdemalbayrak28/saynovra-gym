import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { CheckinDto, LiveEvent, MeResponse, MemberProfile } from '../../../shared/contract';
import { ApiError, api } from './api';
import { LIVE_URL } from './config';
import { deleteSecure, readSecure, writeSecure } from './storage';

const STORAGE_KEY = 'novra.session.v1';
const MAX_BACKOFF_MS = 10_000;

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
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

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
  const tokenRef = useRef<string | null>(null);

  const signOut = useCallback(async () => {
    tokenRef.current = null;
    setSession(null);
    setMe(null);
    setLastCheckin(null);
    setStatus('signedOut');
    await deleteSecure(STORAGE_KEY);
  }, []);

  const refreshMe = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    try {
      setMe(await api.me(token));
      setMeError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await signOut();
        return;
      }
      setMeError(err instanceof ApiError ? err.message : 'Bilgiler alınamadı');
    }
  }, [signOut]);

  const signIn = useCallback(
    async (phone: string, password: string) => {
      const result = await api.login(phone, password);
      const stored: StoredSession = { token: result.token, qrSecret: result.qrSecret, member: result.member };
      await writeSecure(STORAGE_KEY, JSON.stringify(stored));
      tokenRef.current = stored.token;
      setSession(stored);
      setStatus('signedIn');
      await refreshMe();
    },
    [refreshMe],
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
        tokenRef.current = stored.token;
        setSession(stored);
        setStatus('signedIn');
        void refreshMe();
      });
    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  // Live gate events for this member; reconnects with backoff while signed in.
  const token = session?.token ?? null;
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
        if (event?.type !== 'checkin') return;
        setLastCheckin({ checkin: event.checkin, receivedAt: Date.now() });
        // A granted pass moves the presence sequence on; the QR screen needs it at once for the next code.
        setMe((current) =>
          current && event.checkin.result === 'granted'
            ? { ...current, isInside: event.checkin.direction === 'in', presenceSeq: event.checkin.id, gym: event.gym }
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
  }, [token, refreshMe]);

  const value = useMemo<SessionValue>(
    () => ({ status, session, me, meError, lastCheckin, liveConnected, signIn, signOut, refreshMe }),
    [status, session, me, meError, lastCheckin, liveConnected, signIn, signOut, refreshMe],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
