import { redirect } from 'next/navigation';
import { SplitShell } from '../../components/SplitShell';
import { Eyebrow, Headline } from '../../components/ui';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { getCurrentUser } from '../../lib/session';

/**
 * Login screen (docs/ui/screens.md §5): headline "SIGN IN." on the cream
 * half, the Google button on the dark half. Already signed in → /profile.
 */
export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/profile');
  }

  return (
    <SplitShell
      left={
        <>
          <Eyebrow>Coding Arena</Eyebrow>
          <div className="mt-4">
            <Headline>Sign in.</Headline>
          </div>
          <p className="mt-6 max-w-sm font-mono text-xs uppercase leading-relaxed tracking-[0.1em] text-muted-light">
            Two players. One challenge. Ten minutes. First to pass all tests wins.
          </p>
        </>
      }
      right={
        <>
          <Eyebrow dark>Google account</Eyebrow>
          <div className="mt-8">
            <GoogleSignInButton />
          </div>
          <p className="mt-8 max-w-sm font-mono text-xs uppercase leading-relaxed tracking-[0.1em] text-muted-dark">
            Sign in with your Google account. No passwords here.
          </p>
        </>
      }
      leftFooter="One problem. First correct solution wins."
      rightFooter="Rating changes only when the match ends."
    />
  );
}
