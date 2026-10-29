'use client';

import { useCallback, useMemo, useState } from 'react';
import { LANGUAGES, MAX_CODE_LENGTH, type Language } from '@coding-arena/shared';
import type { ChallengeDetail, VisibleTest } from '../lib/practice';

/**
 * The workbench (docs/features/F04-practice-mode.md): language chips, a plain
 * monospace editor (tab indents), RUN + SUBMIT, and the per-test results
 * panel. RUN judges visible samples only; SUBMIT judges everything — hidden
 * tests arrive here as pass/fail only (the server redacts their input/expected
 * before they ever leave it).
 */

type TestResult = {
  index: number;
  hidden: boolean;
  pass: boolean;
  status: string;
  args?: string;
  expected?: string;
  stdout?: string;
  stderr?: string;
};

type RunOutcome = {
  status: string;
  passed: number;
  total: number;
  results: TestResult[];
};

const LANGUAGE_LABELS: Record<Language, string> = { javascript: 'JS', python: 'PY' };

/** Player-facing words for the aggregate statuses (never raw enum names). */
const STATUS_LABELS: Record<string, string> = {
  accepted: 'Accepted',
  wrong_answer: 'Wrong answer',
  time_limit: 'Time limit exceeded',
  memory_limit: 'Memory limit exceeded',
  runtime_error: 'Runtime error',
  compile_error: 'Compile error',
  internal_error: 'Judge error — try again',
};

export function CodePanel({ challenge }: { challenge: ChallengeDetail }) {
  const [language, setLanguage] = useState<Language>('javascript');
  // Per-language scratchpads: switching languages never loses typed code.
  const [code, setCode] = useState<Record<Language, string>>(() => ({
    javascript: challenge.starterCode.javascript,
    python: challenge.starterCode.python,
  }));
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [busy, setBusy] = useState<null | 'run' | 'submit'>(null);
  const [error, setError] = useState<string | null>(null);

  const source = code[language];
  const overLimit = source.length > MAX_CODE_LENGTH;

  const setLanguageAndKeep = (lang: Language) => {
    setLanguage(lang);
    setOutcome(null);
    setError(null);
  };

  const judge = useCallback(
    async (kind: 'run' | 'submit') => {
      setBusy(kind);
      setError(null);
      setOutcome(null);
      try {
        const res = await fetch(`/api/challenges/${challenge.slug}/${kind}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ language, sourceCode: code[language] }),
        });
        const data = (await res.json().catch(() => null)) as
          | (RunOutcome & { message?: string; error?: string })
          | null;
        if (res.status === 429) {
          setError(data?.message ?? 'Too many runs — wait a few minutes.');
        } else if (!res.ok) {
          setError('The judge refused this request. Check your code and try again.');
        } else if (data) {
          setOutcome(data);
        }
      } catch {
        setError('Could not reach the judge. Check your connection and try again.');
      } finally {
        setBusy(null);
      }
    },
    [challenge.slug, language, code],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart, selectionEnd } = el;
    const next = `${source.slice(0, selectionStart)}  ${source.slice(selectionEnd)}`;
    setCode((c) => ({ ...c, [language]: next }));
    requestAnimationFrame(() => {
      el.selectionStart = selectionStart + 2;
      el.selectionEnd = selectionStart + 2;
    });
  };

  const banner = useMemo(() => {
    if (!outcome) return null;
    const label = STATUS_LABELS[outcome.status] ?? outcome.status;
    const accepted = outcome.status === 'accepted';
    return (
      <div
        className={`flex items-center justify-between gap-3 border px-4 py-3 font-mono text-xs font-bold uppercase tracking-[0.1em] ${
          accepted
            ? 'border-accent bg-accent text-carbon'
            : 'border-line-dark bg-surface text-neutral-300'
        }`}
      >
        <span>
          {accepted ? '✓ ' : ''}
          {label}
        </span>
        <span className={accepted ? 'text-carbon' : 'text-neutral-400'}>
          {outcome.passed}/{outcome.total} passed
        </span>
      </div>
    );
  }, [outcome]);

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="flex items-center gap-2.5 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400">
          <span aria-hidden className="inline-block h-1.5 w-3.5 bg-accent" />
          Workbench
        </p>
        {/* Language chips — JS / PY */}
        <div className="flex gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLanguageAndKeep(lang)}
              aria-pressed={language === lang}
              className={`px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.1em] transition-colors ${
                language === lang
                  ? 'bg-accent text-carbon'
                  : 'border border-line-dark bg-surface text-neutral-300 hover:text-cream'
              }`}
            >
              {LANGUAGE_LABELS[lang]}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-line-dark bg-surface">
        <textarea
          value={source}
          onChange={(e) => setCode((c) => ({ ...c, [language]: e.target.value }))}
          onKeyDown={onKeyDown}
          spellCheck={false}
          aria-label={`Code editor — ${language}`}
          className="block h-72 w-full resize-y bg-transparent p-4 font-mono text-sm leading-relaxed text-cream outline-none sm:h-80"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => judge('run')}
          disabled={busy !== null || overLimit || source.trim().length === 0}
          className="border border-line-dark bg-surface px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-cream transition-colors hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === 'run' ? 'Running…' : 'Run'}
        </button>
        <button
          type="button"
          onClick={() => judge('submit')}
          disabled={busy !== null || overLimit || source.trim().length === 0}
          className="bg-accent px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-carbon transition-colors hover:bg-[#ff6231] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === 'submit' ? 'Judging…' : 'Submit'}
        </button>
        <span className="font-mono text-[11px] tracking-[0.05em] text-neutral-500">
          {LANGUAGE_LABELS[language]} · 5s CPU · 256 MB
        </span>
      </div>

      {overLimit && (
        <p className="mt-3 font-grotesk text-sm text-accent">
          Your code is over the {MAX_CODE_LENGTH.toLocaleString('en-US')}-character limit.
        </p>
      )}
      {error && <p className="mt-3 font-grotesk text-sm text-accent">{error}</p>}

      {banner}

      {outcome && outcome.results.length > 0 && (
        <div className="mt-3 border border-line-dark">
          {outcome.results.map((r) => (
            <TestRow key={r.index} result={r} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One test row: visible tests show args/expected/your return; hidden tests show pass/fail only. */
function TestRow({ result }: { result: TestResult }) {
  const [open, setOpen] = useState(false);
  const passColor = result.pass ? 'text-accent' : 'text-neutral-400';
  return (
    <div className="border-b border-line-dark last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-mono text-xs"
      >
        <span className="flex items-center gap-3">
          <span className={`font-bold uppercase tracking-[0.1em] ${passColor}`}>
            {result.pass ? 'Pass' : 'Fail'}
          </span>
          <span className="uppercase tracking-[0.1em] text-neutral-300">
            {result.hidden ? 'Hidden test' : `Test ${result.index + 1}`}
          </span>
          <span className="text-neutral-500">{STATUS_LABELS[result.status] ?? result.status}</span>
        </span>
        {!result.hidden && (
          <span aria-hidden className="text-neutral-500">
            {open ? '−' : '+'}
          </span>
        )}
      </button>
      {open && !result.hidden && (
        <TestDetail result={result} />
      )}
      {open && result.hidden && (
        <p className="px-4 pb-3 font-grotesk text-sm text-neutral-400">
          Hidden test — its arguments stay sealed until you solve it honestly.
        </p>
      )}
    </div>
  );
}

/** Visible-test detail: the three facts — arguments, expected, your return value (+ stderr when it crashed). */
function TestDetail({ result }: { result: TestResult }) {
  return (
    <div className="space-y-2 border-t border-line-dark px-4 py-3">
      <IODock label="Arguments" value={typeof result.args === 'string' ? result.args : '[]'} />
      <IODock label="Expected" value={result.expected ?? ''} />
      <IODock label="Your return value" value={result.stdout ?? ''} />
      {result.stderr && result.status !== 'accepted' && (
        <IODock label="Error" value={result.stderr} tone="error" />
      )}
    </div>
  );
}

function IODock({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'error' }) {
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">{label}</p>
      <pre
        className={`max-h-40 overflow-auto whitespace-pre-wrap break-words border border-line-dark bg-carbon p-2.5 font-mono text-xs leading-relaxed ${
          tone === 'error' ? 'text-accent' : 'text-neutral-200'
        }`}
      >
        {value === '' ? '—' : value}
      </pre>
    </div>
  );
}

/** Sample tests shown on the cream half (statement side): the call arguments and the frozen answer. */
export function SampleTests({ tests, entryFunction }: { tests: VisibleTest[]; entryFunction: string }) {
  return (
    <div className="mt-8">
      <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted">
        Sample tests {entryFunction && <span className="normal-case tracking-[0.05em]">— {entryFunction}(…)</span>}
      </p>
      <div className="space-y-3">
        {tests.map((t, i) => (
          <div key={i} className="grid gap-3 border border-line-light bg-sand/60 p-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                Arguments {tests.length > 1 ? i + 1 : ''}
              </p>
              <pre className="overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-carbon">
                {JSON.stringify(t.args)}
              </pre>
            </div>
            <div>
              <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                Expected
              </p>
              <pre className="overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-carbon">
                {t.expected}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
