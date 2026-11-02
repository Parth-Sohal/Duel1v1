'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
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

/**
 * Tiny tokenizer for the editor's highlight underlay (owner workbench mockup):
 * keywords in accent, strings green, comments muted. Cosmetic only — the
 * textarea on top holds the real code; a broken highlight can never change it.
 */
const KEYWORDS: Record<Language, string> = {
  javascript:
    'function|return|const|let|var|if|else|for|while|of|in|new|class|true|false|null|undefined|typeof|break|continue|do|switch|case|default|throw|try|catch',
  python:
    'def|return|if|elif|else|for|while|in|not|and|or|True|False|None|import|from|class|pass|break|continue|lambda|with|as|is|raise|try|except|finally',
};

function highlightCode(code: string, lang: Language): ReactNode[] {
  const comment = lang === 'javascript' ? '\\/\\/[^\\n]*' : '#[^\\n]*';
  const re = new RegExp(
    `(${comment})|(\`(?:[^\`\\\\]|\\\\.)*\`|"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')|\\b(${KEYWORDS[lang]})\\b|\\b(\\d+(?:\\.\\d+)?)\\b`,
    'g',
  );
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) nodes.push(code.slice(last, m.index));
    const [full, commentHit, stringHit, keywordHit, numberHit] = m;
    const cls = commentHit
      ? 'text-neutral-500 italic'
      : stringHit
        ? 'text-easy'
        : keywordHit
          ? 'font-semibold text-accent'
          : numberHit
            ? 'text-neutral-300'
            : '';
    nodes.push(<span key={key++} className={cls}>{full}</span>);
    last = m.index + full.length;
    if (full.length === 0) re.lastIndex += 1;
  }
  if (last < code.length) nodes.push(code.slice(last));
  return nodes;
}

/** The match-finish payload the duel submit endpoint may include. */
export type MatchOutcome = {
  resultType: 'win' | 'draw' | 'forfeit';
  winnerId: string | null;
  deltas: Record<string, number>;
};

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

export function CodePanel({
  challenge,
  submitPath,
  onOutcome,
  locked = false,
}: {
  challenge: ChallengeDetail;
  /** Where SUBMIT posts (duels use /api/matches/:id/submit); defaults to practice. */
  submitPath?: string;
  /** Called with the parsed submit/run outcome (duel finish handling). */
  onOutcome?: (data: RunOutcome & { matchFinished?: boolean; matchOutcome?: MatchOutcome | null }) => void;
  /** True when the duel is over — the workbench freezes. */
  locked?: boolean;
}) {
  const [language, setLanguage] = useState<Language>('javascript');
  // Per-language scratchpads: switching languages never loses typed code.
  const [code, setCode] = useState<Record<Language, string>>(() => ({
    javascript: challenge.starterCode.javascript,
    python: challenge.starterCode.python,
  }));
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [outcomeLang, setOutcomeLang] = useState<Language>('javascript');
  const [busy, setBusy] = useState<null | 'run' | 'submit'>(null);
  const [error, setError] = useState<string | null>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const [gutterScroll, setGutterScroll] = useState(0);
  const lineCount = Math.max(1, code[language].split('\n').length);

  const source = code[language];
  const overLimit = source.length > MAX_CODE_LENGTH;

  const setLanguageAndKeep = (lang: Language) => {
    setLanguage(lang);
    setOutcome(null);
    setError(null);
  };

  const judge = useCallback(
    async (kind: 'run' | 'submit') => {
      if (locked) return;
      setBusy(kind);
      setError(null);
      setOutcome(null);
      try {
        const url =
          kind === 'run' ? `/api/challenges/${challenge.slug}/run` : (submitPath ?? `/api/challenges/${challenge.slug}/submit`);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ language, sourceCode: code[language] }),
        });
        const data = (await res.json().catch(() => null)) as
          | (RunOutcome & { message?: string; error?: string; matchFinished?: boolean; matchOutcome?: MatchOutcome | null })
          | null;
        if (res.status === 429) {
          setError(data?.message ?? 'Too many runs — wait a few minutes.');
        } else if (!res.ok) {
          setError('The judge refused this request. Check your code and try again.');
        } else if (data) {
          setOutcome(data);
          setOutcomeLang(language);
          onOutcome?.(data);
        }
      } catch {
        setError('Could not reach the judge. Check your connection and try again.');
      } finally {
        setBusy(null);
      }
    },
    [challenge.slug, language, code, submitPath, onOutcome, locked],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd+Enter submits from inside the editor (no mouse needed).
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!locked && busy === null && !overLimit && source.trim().length > 0) judge('submit');
      return;
    }
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

      <div className="relative border border-line-dark bg-surface">
        {/* faint house watermark (mockup) */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-4 right-5 z-10 select-none font-mono text-2xl font-bold text-cream/[0.05]"
        >
          {'{duel}'}
        </span>
        {/* line-number gutter — translates with the editor scroll */}
        <div aria-hidden className="absolute bottom-0 left-0 top-0 z-10 w-10 overflow-hidden border-r border-line-dark bg-surface">
          <pre
            className="px-2 pt-4 text-right font-mono text-sm leading-relaxed text-neutral-600"
            style={{ transform: `translateY(-${gutterScroll}px)` }}
          >
            {Array.from({ length: lineCount }, (_, i) => i + 1).join('\n')}
          </pre>
        </div>
        {/* highlight underlay — the textarea above renders its own text transparent */}
        <pre
          ref={highlightRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words py-4 pl-14 pr-4 font-mono text-sm leading-relaxed text-cream"
        >
          {highlightCode(source, language)}
        </pre>
        <textarea
          value={source}
          onChange={(e) => setCode((c) => ({ ...c, [language]: e.target.value }))}
          onKeyDown={onKeyDown}
          onScroll={(e) => {
            if (highlightRef.current) highlightRef.current.scrollTop = e.currentTarget.scrollTop;
            setGutterScroll(e.currentTarget.scrollTop);
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={`Code editor — ${language}`}
          style={{ caretColor: '#ff4d15' }}
          className="relative block h-96 w-full resize-y bg-transparent py-4 pl-14 pr-4 font-mono text-sm leading-relaxed text-transparent outline-none selection:bg-accent/30 sm:h-[28rem]"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => judge('run')}
          disabled={locked || busy !== null || overLimit || source.trim().length === 0}
          className="border border-line-dark bg-surface px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-cream transition-colors hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === 'run' ? 'Running…' : 'Run'}
        </button>
        <button
          type="button"
          onClick={() => judge('submit')}
          disabled={locked || busy !== null || overLimit || source.trim().length === 0}
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
        <div className="mt-3 border border-line-dark bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-line-dark px-4 py-2.5">
            <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-300">
              <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
              {outcome.status === 'accepted' || outcome.status === 'wrong_answer' ? 'Results' : 'Sample results'}
            </p>
            <span
              className={`font-mono text-[11px] font-bold uppercase tracking-[0.1em] ${
                outcome.passed === outcome.total ? 'text-accent' : 'text-neutral-400'
              }`}
            >
              {outcome.passed}/{outcome.total} passed
            </span>
          </div>
          {outcome.results.map((r) => (
            <TestRow key={r.index} result={r} entryFunction={challenge.entryFunctions[outcomeLang]} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One test row: visible tests show the call + expected inline and expand to
 * the full IO docks; hidden tests show pass/fail only (sealed inputs). */
function TestRow({ result, entryFunction }: { result: TestResult; entryFunction: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line-dark last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left font-mono text-xs"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span aria-hidden className={result.pass ? 'font-bold text-accent' : 'text-neutral-500'}>
            {result.pass ? '✓' : '✗'}
          </span>
          <span className="flex-shrink-0 uppercase tracking-[0.1em] text-neutral-300">
            {result.hidden ? 'Hidden test' : `Test #${result.index + 1}`}
          </span>
          {!result.hidden && (
            <span className="min-w-0 truncate text-neutral-500">
              {entryFunction}({result.args ?? ''}) == {result.expected ?? ''}
            </span>
          )}
          {result.hidden && (
            <span className="text-neutral-500">{STATUS_LABELS[result.status] ?? result.status}</span>
          )}
        </span>
        <span
          className={`flex-shrink-0 font-bold uppercase tracking-[0.1em] ${
            result.pass ? 'text-accent' : 'text-neutral-400'
          }`}
        >
          {result.pass ? 'Passed' : 'Failed'}
        </span>
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

/** Sample tests shown on the cream half (statement side): a bordered table of
 * the call arguments and the frozen answer (owner workbench mockup). */
export function SampleTests({ tests, entryFunction }: { tests: VisibleTest[]; entryFunction: string }) {
  return (
    <div className="mt-8">
      <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted">
        Sample tests {entryFunction && <span className="normal-case tracking-[0.05em]">— {entryFunction}(…)</span>}
      </p>
      <div className="overflow-x-auto border border-line-light">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-line-light bg-sand/60">
              <th scope="col" className="w-1/2 px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                Arguments
              </th>
              <th scope="col" className="w-1/2 px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                Expected
              </th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t, i) => (
              <tr key={i} className="border-b border-line-light align-top last:border-b-0">
                <td className="px-4 py-2.5">
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-carbon">
                    {JSON.stringify(t.args)}
                  </pre>
                </td>
                <td className="px-4 py-2.5">
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-carbon">
                    {t.expected}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
