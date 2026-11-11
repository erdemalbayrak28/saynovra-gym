import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';
import { useSession } from './session';

interface Resource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Loads `fetcher(token)` whenever the screen gains focus, so a screen shows fresh data after the
 * user comes back from another one (e.g. the workout). Expired sessions sign the user out.
 */
export function useResource<T>(fetcher: (token: string) => Promise<T>): Resource<T> {
  const { session, signOut } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Callers may pass inline lambdas; reading the latest one through a ref keeps `reload` stable.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });
  const token = session?.token ?? null;

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setData(await fetcherRef.current(token));
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await signOut();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Bilgiler alınamadı');
    } finally {
      setLoading(false);
    }
  }, [token, signOut]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { data, error, loading, reload };
}
