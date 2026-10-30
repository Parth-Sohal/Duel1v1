import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/session';
import { RoomLobby } from '../../../components/RoomLobby';

/** Friend-room lobby (docs/features/F05-friend-rooms.md): seats, presence, ready, invite, start. */
export default async function DuelRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  const { code } = await params;
  return <RoomLobby code={code.toUpperCase()} myUserId={user.id} />;
}
