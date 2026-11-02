import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SplitShell } from '../../../components/SplitShell';
import { CodePanel, SampleTests } from '../../../components/CodePanel';
import { Chip, Eyebrow, Headline } from '../../../components/ui';
import { getCurrentUser } from '../../../lib/session';
import { getChallengeDetail, type ChallengeDetail } from '../../../lib/practice';

/** Designed not-found (unknown slug or unpublished challenge). */
function NotFound() {
  return (
    <SplitShell
      left={
        <>
          <div className="mb-4">
            <Eyebrow marker="square">Practice</Eyebrow>
          </div>
          <Headline className="mb-6 text-[clamp(2.5rem,6vw,4.5rem)]">No challenge.</Headline>
          <p className="max-w-md font-grotesk text-sm leading-relaxed text-muted">
            Nothing lives at this address — the slug may be wrong, or the challenge is not published yet.
          </p>
          <div className="mt-8 max-w-md border-t border-line-light pt-6">
            <Link
              href="/practice"
              className="inline-block border border-carbon/40 bg-accent px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-carbon transition-colors hover:bg-[#ff6231]"
            >
              All challenges ➔
            </Link>
          </div>
        </>
      }
      right={
        <div className="mx-auto w-full max-w-md">
          <div className="mb-4">
            <Eyebrow dark marker="notch">
              Arena protocol
            </Eyebrow>
          </div>
          <h2 className="mb-3 font-headline text-3xl font-extrabold uppercase tracking-tight text-cream sm:text-4xl">
            Sealed floor.
          </h2>
          <p className="font-grotesk text-sm leading-relaxed text-neutral-300">
            Challenges go live only after the owner signs off their statements and frozen outputs.
          </p>
        </div>
      }
      leftFooter="The server is the referee."
      rightFooter="Runs show samples only. Submissions judge hidden tests."
    />
  );
}

/**
 * Practice detail (docs/features/F04-practice-mode.md): statement + samples on
 * the cream half, the workbench on the dark half. The server has already
 * stripped the hidden tests — this page never sees them.
 */
export default async function ChallengePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const { slug } = await params;
  const challenge = await getChallengeDetail(slug);
  if (!challenge) {
    return <NotFound />;
  }

  return <ChallengeView challenge={challenge} />;
}

function ChallengeView({ challenge }: { challenge: ChallengeDetail }) {
  return (
    <SplitShell
      left={
        <>
          <div className="mb-4 flex items-center justify-between gap-4">
            <Eyebrow marker="square">Practice · {challenge.difficulty}</Eyebrow>
            <Link
              href="/practice"
              className="flex-shrink-0 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-accent"
            >
              ← All challenges
            </Link>
          </div>
          <Headline className="mb-5 text-[clamp(2.25rem,5vw,4rem)]">{challenge.title}</Headline>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <Chip>{challenge.difficulty}</Chip>
            {challenge.tags.map((tag: string) => (
              <span key={tag} className="font-mono text-xs text-muted">
                {tag}
              </span>
            ))}
            <span className="font-mono text-xs text-muted">· version {challenge.version}</span>
          </div>
          <p className="whitespace-pre-wrap font-grotesk text-sm leading-relaxed text-carbon">
            {challenge.statement}
          </p>
          <SampleTests tests={challenge.visibleTests} entryFunction={challenge.entryFunctions.javascript} />
        </>
      }
      right={<CodePanel challenge={challenge} />}
      leftFooter={`${(challenge.timeLimitMs / 1000).toFixed(0)}s CPU · ${challenge.memoryLimitMb} MB memory · your function's return value is compared against the frozen answer.`}
      rightFooter="Runs call your function on samples only. Submissions judge hidden tests."
    />
  );
}
