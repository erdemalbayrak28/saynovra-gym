import { useCallback, useState } from 'react';
import { Kiosk } from './pages/Kiosk';
import { StaffLogin } from './pages/StaffLogin';
import { clearSession, loadSession, saveSession, type StaffSession } from './lib/session';

export function App() {
  const [session, setSession] = useState<StaffSession | null>(loadSession);

  const login = useCallback((next: StaffSession) => {
    saveSession(next);
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  if (!session) return <StaffLogin onLogin={login} />;
  return <Kiosk session={session} onLogout={logout} />;
}
