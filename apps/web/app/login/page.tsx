import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SplitShell } from '../../components/SplitShell';
import { Chip, Eyebrow, Headline } from '../../components/ui';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { getCurrentUser } from '../../lib/session';

/** Real protocol facts (decisions D3/D6) — no sample stats. */
function ProtocolCard() {
  const rows: Array<[string, string]> = [
    ['Supported runtimes', 'JavaScript · Python'],
    ['Match clock', '10:00, server-owned'],
    ['Verdicts', 'The server is the referee'],
  ];
  return (
    <div className="border border-line-dark bg-surface/80 p-4">
      <div className="mb-3 flex items-center justify-between border-b border-neutral-800 pb-2 font-mono text-xs">
        <span className="flex items-center gap-2 text-neutral-300">
          <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
          <span className="font-semibold uppercase tracking-[0.1em]">Arena protocol</span>
        </span>
        <span className="text-[10px] uppercase tracking-[0.1em] text-neutral-400">Fixed rules</span>
      </div>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <span className="font-mono text-xs uppercase tracking-[0.05em] text-neutral-400">
              {label}:
            </span>
            <span className="text-right font-grotesk text-sm font-medium text-neutral-200">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Build the Google OAuth redirect URL for wherever the app is being served. */
async function buildAuthUrl(): Promise<{ url: string; configured: boolean }> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return { url: '', configured: false };

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const redirectUri = `${proto}://${host}/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'id_token',
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    state: crypto.randomUUID(),
    nonce: crypto.randomUUID(),
    prompt: 'select_account',
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, configured: true };
}

/**
 * Login screen (owner brutalist design): "SIGN IN." as the single focal
 * point on the cream half, the auth portal on the dark half, content
 * vertically centered.
 */
export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/profile');
  }
  const { url: authUrl, configured } = await buildAuthUrl();

  return (
    <SplitShell
      left={
        <>
          <div className="mb-4">
            <Eyebrow marker="square">Coding Arena // Round protocol</Eyebrow>
          </div>
          <Headline className="mb-6 text-[clamp(3rem,7vw,5.5rem)]">Sign in.</Headline>

          {/* The rules — sentence case body copy, two sizes only */}
          <div className="my-6 max-w-md space-y-2 border-l-2 border-carbon pl-4">
            <p className="font-grotesk text-base font-bold leading-snug text-carbon">
              Two players. One challenge. Ten minutes.
            </p>
            <p className="font-grotesk text-sm leading-relaxed text-muted">
              First to pass all automated test cases wins. Rating changes only when the match
              ends.
            </p>
          </div>

          {/* Real launch facts instead of sample divisions */}
          <div className="mt-8 max-w-md border-t border-line-light/80 pt-6">
            <span className="mb-3 block font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted">
              Languages at launch
            </span>
            <div className="flex flex-wrap gap-2">
              <Chip>JavaScript</Chip>
              <Chip>Python</Chip>
              <Chip variant="accent">Rated 1v1</Chip>
            </div>
          </div>
        </>
      }
      right={
        <div className="mx-auto w-full max-w-md">
          <div className="mb-4">
            <Eyebrow dark marker="notch">
              Google account / SSO gate
            </Eyebrow>
          </div>
          <h2 className="mb-2 font-headline text-3xl font-extrabold uppercase tracking-tight text-cream sm:text-4xl">
            Authenticate
          </h2>
          <p className="mb-8 font-grotesk text-sm leading-relaxed text-neutral-300">
            Sign in with your Google account. No passwords stored.
          </p>

          {configured ? (
            <GoogleSignInButton authUrl={authUrl} />
          ) : (
            <p className="border border-line-dark bg-surface/80 p-4 font-mono text-xs tracking-[0.05em] text-neutral-300">
              Google sign-in is not configured yet.
            </p>
          )}

          <div className="mt-8">
            <ProtocolCard />
          </div>

          <p className="mt-6 font-grotesk text-sm leading-relaxed text-neutral-400">
            Sessions last 30 days behind an HTTP-only cookie. Sign out any time.
          </p>
        </div>
      }
      leftFooter="Two players. One challenge. Ten minutes."
      rightFooter="The server is the referee. Outcomes are decided server-side."
    />
  );
}
