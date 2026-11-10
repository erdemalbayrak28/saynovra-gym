import { useCallback, useState } from 'react';
import { AppShell } from './components/AppShell';
import { GatePanel } from './components/GatePanel';
import { LiveProvider } from './lib/live';
import { useRoute } from './lib/route';
import { clearSession, loadSession, saveSession, type StaffSession } from './lib/session';
import { DemoView } from './pages/Demo';
import { FormCoach } from './pages/FormCoach';
import { ReceptionPanel } from './pages/Reception';
import { StaffLogin } from './pages/StaffLogin';

export function App() {
  const [session, setSession] = useState<StaffSession | null>(loadSession);
  const route = useRoute();

  const login = useCallback((next: StaffSession) => {
    saveSession(next);
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  if (!session) return <StaffLogin onLogin={login} />;
  return (
    <LiveProvider token={session.token}>
      <AppShell route={route} session={session} onLogout={logout} wide={route === 'demo'}>
        {route === 'kapi' && <GatePanel token={session.token} onUnauthorized={logout} />}
        {route === 'resepsiyon' && <ReceptionPanel session={session} onUnauthorized={logout} />}
        {route === 'form' && <FormCoach />}
        {route === 'demo' && <DemoView session={session} onUnauthorized={logout} />}
      </AppShell>
    </LiveProvider>
  );
}
