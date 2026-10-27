import { redirect } from 'next/navigation';
import { getCurrentUser } from '../lib/session';

/**
 * Home: the only existing destinations in Iteration 1 are the login screen
 * and the profile, so the root sends players to the right one of the two.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? '/profile' : '/login');
}
