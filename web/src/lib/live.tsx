import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LiveEvent } from '../../../shared/contract';
import { LIVE_URL } from './config';

export type LiveState = 'connecting' | 'open' | 'offline';
type Listener = (event: LiveEvent) => void;

const MAX_BACKOFF_MS = 10_000;
const KNOWN_TYPES = new Set<LiveEvent['type']>(['checkin', 'radar', 'spot_request', 'spot_message', 'floor', 'membership']);

interface LiveValue {
  state: LiveState;
  subscribe: (listener: Listener) => () => void;
}

const LiveContext = createContext<LiveValue | null>(null);

/** One /live connection for every panel on the page; reconnects with exponential backoff. */
export function LiveProvider({ token, children }: { token: string; children: ReactNode }) {
  const [state, setState] = useState<LiveState>('connecting');
  const listeners = useRef(new Set<Listener>());

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let attempt = 0;
    let timer: number | undefined;
    let stopped = false;

    const connect = () => {
      setState('connecting');
      socket = new WebSocket(`${LIVE_URL}?token=${encodeURIComponent(token)}`);
      socket.onopen = () => {
        attempt = 0;
        setState('open');
      };
      socket.onmessage = (message) => {
        let event: LiveEvent;
        try {
          event = JSON.parse(String(message.data)) as LiveEvent;
        } catch {
          return;
        }
        if (!event || typeof event !== 'object' || !KNOWN_TYPES.has(event.type)) return;
        for (const listener of listeners.current) listener(event);
      };
      socket.onclose = () => {
        if (stopped) return;
        setState('offline');
        timer = window.setTimeout(connect, Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt++));
      };
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      socket?.close();
    };
  }, [token]);

  const value = useMemo(() => ({ state, subscribe }), [state, subscribe]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

function useLive(): LiveValue {
  const value = useContext(LiveContext);
  if (!value) throw new Error('Live hooks must be used inside <LiveProvider>');
  return value;
}

export function useLiveState(): LiveState {
  return useLive().state;
}

/** Runs `handler` for every live event while the component is mounted. */
export function useLiveEvent(handler: Listener): void {
  const { subscribe } = useLive();
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => subscribe((event) => latest.current(event)), [subscribe]);
}
