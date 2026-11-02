import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SplitShell } from '../../../components/SplitShell';
import { CodePanel, SampleTests } from '../../../components/CodePanel';
import { EngineLatency } from '../../../components/EngineLatency';
import { Eyebrow, Headline } from '../../../components/ui';
import { getCurrentUser } from '../../../lib/session';
import { getChallengeDetail, type ChallengeDetail } from '../../../lib/practice';

const DIFF_TEXT: Record<ChallengeDetail['difficulty'], string> = {
  easy: 'text-easy',
  medium: 'text-accent',
  hard: 'text-hard',
};

/** Taxonomy badge with the difficulty's color square (cream-side readable). */
function DifficultyChip({ difficulty }: { difficulty: ChallengeDetail['difficulty'] }) {
  return (
    <span className="flex items-center gap-2 border border-line-light bg-sand/80 px-2.5 py-1 font-mono text-xs font-medium tracking-[0.05em] text-carbon">
      <span aria-hidden className={`inline-block h-2 w-2 bg-current ${DIFF_TEXT[difficulty]}`} />
      {difficulty}
    </span>
  );
}

/**
 * Statement renderer: the first block is the function signature (mono box),
 * PARAMETERS / RETURNS blocks become labeled sections, anything else is body
 * copy. Works off the raw statement text — same content, structured layout.
 */
function StatementBody({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        const header = block.split('\n')[0].trim();
        if (i === 0) {
          return (
            <pre
              key={i}
              className="overflow-x-auto border border-line-light bg-sand/60 px-3 py-2 font-mono text-sm font-bold text-carbon"
            >
              {block}
            </pre>
          );
        }
        if (header === 'PARAMETERS' || header === 'RETURNS') {
          const items = block
            .split('\n')
            .slice(1)
            .map((line) => line.trim())
            .filter(Boolean);
          return (
            <div key={i}>
              <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted">{header}</p>
              <ul className="space-y-1.5">
                {items.map((item, j) => (
                  <li key={j} className="font-grotesk text-sm leading-relaxed text-carbon">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        return (
          <p key={i} className="font-grotesk text-sm leading-relaxed text-carbon">
            {block}
          </p>
        );
      })}
    </div>
  );
}

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
      resizable
      tickerExtra={
        <>
          <EngineLatency />
          <span className="hidden font-mono text-xs tracking-[0.05em] text-neutral-500 lg:inline">
            [CTRL] + [ENTER] SUBMIT
          </span>
        </>
      }
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
            <DifficultyChip difficulty={challenge.difficulty} />
            {challenge.tags.map((tag: string) => (
              <span key={tag} className="border border-line-light bg-sand/80 px-2.5 py-1 font-mono text-xs font-medium tracking-[0.05em] text-muted">
                {tag}
              </span>
            ))}
            <span className="font-mono text-xs text-muted">· version {challenge.version}</span>
          </div>
          <StatementBody text={challenge.statement} />
          <SampleTests tests={challenge.visibleTests} entryFunction={challenge.entryFunctions.javascript} />
        </>
      }
      right={<CodePanel challenge={challenge} />}
      leftFooter={`${(challenge.timeLimitMs / 1000).toFixed(0)}s CPU · ${challenge.memoryLimitMb} MB memory · your function's return value is compared against the frozen answer.`}
      rightFooter="Runs call your function on samples only. Submissions judge hidden tests."
    />
  );
}
