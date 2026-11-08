import { useEffect, useRef, useState } from 'react';
import type { LiveEvent } from '../../../shared/contract';
import { LIVE_URL } from './config';

export type LiveState = 'connecting' | 'open' | 'offline';

const MAX_BACKOFF_MS = 10_000;

/** Subscribes to /live and reconnects with exponential backoff until unmounted. */
export function useLive(token: string, onEvent: (event: LiveEvent) => void): LiveState {
  const [state, setState] = useState<LiveState>('connecting');
  const handler = useRef(onEvent);

  useEffect(() => {
    handler.current = onEvent;
  });

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
        if (event && typeof event === 'object' && event.type === 'checkin') handler.current(event);
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

  return state;
}
