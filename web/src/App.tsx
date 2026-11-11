import { useCallback, useState } from 'react';
import { AppShell } from './components/AppShell';
import { GatePanel } from './components/GatePanel';
import { LiveProvider } from './lib/live';
import { useRoute } from './lib/route';
import { clearSession, loadSession, saveSession, type StaffSession } from './lib/session';
import { DemoView } from './pages/Demo';
import { FormCoach } from './pages/FormCoach';
import { ReceptionPanel } from './pages/Reception';
import { ReelStudio } from './pages/ReelStudio';
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

  if (!session && route === 'reel') {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-[1680px] px-4 py-6 lg:px-8">
          <ReelStudio />
        </main>
      </div>
    );
  }
  if (!session) return <StaffLogin onLogin={login} />;
  return (
    <LiveProvider token={session.token}>
      <AppShell route={route} session={session} onLogout={logout} wide={route === 'demo' || route === 'reel'}>
        {route === 'kapi' && <GatePanel token={session.token} onUnauthorized={logout} />}
        {route === 'resepsiyon' && <ReceptionPanel session={session} onUnauthorized={logout} />}
        {route === 'form' && <FormCoach />}
        {route === 'demo' && <DemoView session={session} onUnauthorized={logout} />}
        {route === 'reel' && <ReelStudio />}
      </AppShell>
    </LiveProvider>
  );
}
