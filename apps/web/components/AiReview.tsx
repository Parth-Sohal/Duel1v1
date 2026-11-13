'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Language } from '@coding-arena/shared';

/**
 * F11 AI code analysis UI (docs/features/F11-ai-analysis.md). A button +
 * review panel the player explicitly opts into — nothing is sent to the
 * model until they click. Rendered inside the practice workbench and on the
 * finished-duel result. The feature disappears entirely when the server
 * reports it disabled (no GEMINI_API_KEY).
 */

type Usage = { enabled: boolean; used?: number; limit?: number; resetAt?: string };

type Review = {
  verdict: 'fail' | 'pass';
  headline: string;
  hints: string[];
  complexity: { time: string; space: string };
  suggestions: string[];
};

const EMPTY_USAGE: Usage = { enabled: false };

export function AiAnalyze({
  slug,
  context,
  language,
  source,
  submissionId = null,
  locked = false,
}: {
  slug: string;
  context: 'practice' | 'duel';
  language: Language;
  source: string;
  /** Required for duel context (the analyzed submission). */
  submissionId?: string | null;
  /** Freezes the button (duel still running). */
  locked?: boolean;
}) {
  const [usage, setUsage] = useState<Usage>(EMPTY_USAGE);
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/ai/usage', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : EMPTY_USAGE))
      .then((u: Usage) => {
        if (alive) setUsage(u);
      })
      .catch(() => {
        /* feature stays hidden on probe failure */
      });
    return () => {
      alive = false;
    };
  }, [review]);

  const analyze = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, language, sourceCode: source, context, submissionId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { review: Review; usage: Usage };
        setReview(data.review);
        setUsage({ enabled: true, used: data.usage.used, limit: data.usage.limit, resetAt: data.usage.resetAt });
      } else if (res.status === 429) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(
          data?.error === 'daily_cap_reached'
            ? "That's all 3 analyses for today — the counter resets at midnight UTC."
            : 'Too fast — wait a minute and try again.',
        );
      } else if (res.status === 413) {
        setError('Code too long for analysis (20,000 characters max).');
      } else if (res.status === 403) {
        setError('Only your own finished-duel code can be reviewed.');
      } else if (res.status === 502 || res.status === 503) {
        setError('The analysis engine is unavailable right now. Try again later.');
      } else {
        setError('Analysis failed. Check your code and try again.');
      }
    } catch {
      setError('Could not reach the analysis engine. Check your connection.');
    } finally {
      setBusy(false);
    }
  }, [slug, language, source, context, submissionId]);

  if (!usage.enabled) return null;

  const disabled = busy || locked || source.trim().length === 0 || (usage.used ?? 0) >= (usage.limit ?? 3);
  const remaining = (usage.limit ?? 3) - (usage.used ?? 0);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={analyze}
          disabled={disabled}
          className="border border-line-dark bg-surface px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-cream transition-colors hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Analyzing…' : 'Analyze'}
        </button>
        <span className="font-mono text-[11px] tracking-[0.05em] text-neutral-500">
          {remaining <= 0 ? '0 of 3 left today' : `${remaining} of 3 left today`} · review by AI, hints only
        </span>
      </div>

      {error && <p className="mt-3 font-grotesk text-sm text-accent">{error}</p>}

      {review && (
        <div className="mt-3 border border-line-dark bg-surface">
          <div
            className={`flex items-center justify-between gap-3 border-b border-line-dark px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.1em] ${
              review.verdict === 'pass' ? 'text-cream' : 'text-neutral-300'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span aria-hidden className={`inline-block h-1.5 w-3.5 ${review.verdict === 'pass' ? 'bg-accent' : 'bg-neutral-500'}`} />
              AI review
            </span>
            <span className="text-neutral-400">{review.verdict === 'pass' ? 'samples pass' : 'samples fail'}</span>
          </div>
          <div className="space-y-4 px-4 py-4">
            <p className="font-grotesk text-sm leading-relaxed text-neutral-200">{review.headline}</p>

            {review.hints.length > 0 && (
              <div>
                <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Hints</p>
                <ul className="space-y-2">
                  {review.hints.map((h, i) => (
                    <li key={i} className="font-grotesk text-sm leading-relaxed text-neutral-300">
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
              <div className="border border-line-dark bg-carbon p-2.5">
                <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Time</p>
                <p className="font-mono text-xs text-neutral-200">{review.complexity.time}</p>
              </div>
              <div className="border border-line-dark bg-carbon p-2.5">
                <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Space</p>
                <p className="font-mono text-xs text-neutral-200">{review.complexity.space}</p>
              </div>
            </div>

            {review.suggestions.length > 0 && (
              <div>
                <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Suggestions</p>
                <ul className="space-y-2">
                  {review.suggestions.map((s, i) => (
                    <li key={i} className="font-grotesk text-sm leading-relaxed text-neutral-300">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
