import { Redirect } from 'expo-router';
import { useSession } from '@/lib/session';

/**
 * The app's root address. Signing in or out lands here, and each kind of account has its own
 * home: members their tabs, trainers their member list.
 */
export default function Index() {
  const { status, session, me } = useSession();
  if (status !== 'signedIn') return <Redirect href="/login" />;
  // Sessions saved before trainers existed carry no role: those are members.
  const role = me?.member.role ?? session?.member.role ?? 'member';
  return <Redirect href={role === 'trainer' ? '/members' : '/home'} />;
}
