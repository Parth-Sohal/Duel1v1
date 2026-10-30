import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/session';
import { DuelLauncher } from '../../components/DuelLauncher';

/**
 * PLAY — pick a duel (docs/features/F05-friend-rooms.md). Owner design:
 * left cream half = format + difficulty, right dark half = create/join.
 * RIVAL is the one real opponent type in v1 (friend rooms); ANYONE
 * (strangers matchmaking) and KERN BOT are later iterations — shown muted.
 */
export default async function DuelPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return <DuelLauncher displayName={user.displayName} />;
}
