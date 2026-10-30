import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/session';
import { MatchWorkbench } from '../../../components/MatchWorkbench';

/** The live duel (docs/features/F06-match-engine.md): countdown, workbench, result overlay. */
export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  const { id } = await params;
  return <MatchWorkbench matchId={id} myUserId={user.id} />;
}
