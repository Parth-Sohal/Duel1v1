'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FooterCaption } from './ui';
import { Header } from './Header';

/** Bottom rules ticker — real protocol rules only (no fake stats). */
function RulesTicker({ extra }: { extra?: ReactNode }) {
  return (
    <footer className="z-20 w-full overflow-hidden border-t border-line-dark bg-void px-5 py-3 select-none sm:px-10">
      <div className="flex items-center gap-4 whitespace-nowrap font-mono text-xs tracking-[0.05em] sm:gap-8">
        <span className="flex-shrink-0 font-bold text-accent">● Protocol rules</span>
        <span className="truncate text-neutral-400">One problem. First correct solution wins.</span>
        <span aria-hidden className="hidden flex-shrink-0 text-neutral-600 md:inline">/ /</span>
        <span className="hidden truncate text-neutral-300 md:inline">
          Rating changes only when the match ends.
        </span>
        {extra && <span className="ml-auto hidden flex-shrink-0 items-center gap-6 md:flex">{extra}</span>}
      </div>
    </footer>
  );
}

/** Collapse / widen controls for one resizable pane (wide screens only). */
function PaneControls({
  side,
  selfCollapsed,
  onCollapse,
  onExpand,
  dark,
}: {
  side: 'left' | 'right';
  selfCollapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  dark: boolean;
}) {
  const base =
    'flex h-6 w-6 items-center justify-center border font-mono text-xs leading-none transition-colors';
  const tone = dark
    ? 'border-line-dark bg-surface text-neutral-400 hover:text-cream'
    : 'border-line-light bg-cream/70 text-muted hover:text-carbon';
  if (selfCollapsed) {
    return (
      <div className="absolute right-2 top-3 z-30 hidden lg:block">
        <button type="button" aria-label={`Expand ${side} pane`} onClick={onExpand} className={`${base} ${tone}`}>
          +
        </button>
      </div>
    );
  }
  return (
    <div className="absolute right-3 top-3 z-30 hidden gap-1 lg:flex">
      <button type="button" aria-label={`Collapse ${side} pane`} onClick={onCollapse} className={`${base} ${tone}`}>
        −
      </button>
      <button type="button" aria-label={`Widen ${side} pane`} onClick={onExpand} className={`${base} ${tone}`}>
        +
      </button>
    </div>
  );
}

/** Width bounds for the draggable split. */
const MIN_PCT = 28;
const MAX_PCT = 78;
const DEFAULT_PCT = 58; // ≈ the classic 7/12 split
const COLLAPSED_W = '2.75rem';

/**
 * The split layout (decision D9): cream left column, near-black right column,
 * one system bar across both, orange seam markers, rules ticker at the bottom.
 * Content is vertically centered and each half clips its own overflow, so the
 * panels can never overlap at any width. Mobile: the halves stack, cream first
 * (D10).
 *
 * `resizable` (workbench mode): the two panes become drag-resizable with a
 * seam handle plus per-pane collapse/widen buttons. Editor state survives
 * collapsing because pane content stays mounted — only its width clips.
 * `tickerExtra` renders at the right end of the rules ticker (latency, hints).
 */
export function SplitShell({
  left,
  right,
  leftFooter,
  rightFooter,
  resizable = false,
  rightScroll = false,
  tickerExtra,
}: {
  left: ReactNode;
  right: ReactNode;
  leftFooter: ReactNode; // string or rich node (e.g. a split keyboard hint)
  rightFooter: ReactNode;
  resizable?: boolean;
  /** Roster mode: the dark half scrolls internally on wide screens so a
   * sticky header band (`.practice-header`) can sit on top of the list. */
  rightScroll?: boolean;
  tickerExtra?: ReactNode;
}) {
  const [leftPct, setLeftPct] = useState(DEFAULT_PCT);
  const [collapsed, setCollapsed] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  const [dragging, setDragging] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const trackRef = useRef<HTMLElement>(null);

  // Resizing only applies at the stacked→split breakpoint.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setLeftPct(Math.min(MAX_PCT, Math.max(MIN_PCT, pct)));
  };
  const endDrag = () => setDragging(false);

  const collapse = (side: 'left' | 'right') => setCollapsed((c) => ({ ...c, [side]: true }));
  const expand = (side: 'left' | 'right') => {
    setCollapsed((c) => {
      const next = { ...c, [side]: false };
      // Widening an already-open pane nudges the seam its way.
      if (!next.left && !next.right) {
        setLeftPct((p) => (side === 'left' ? Math.min(MAX_PCT, p + 10) : Math.max(MIN_PCT, p - 10)));
      }
      return next;
    });
  };

  if (!resizable) {
    return (
      <div className="flex min-h-screen flex-col bg-carbon">
        <div className="relative">
          <Header />
        </div>
        <main className="grid flex-1 grid-cols-1 lg:grid-cols-12">
          {/* Cream half */}
          <section className="relative flex flex-col overflow-hidden border-b border-line-light bg-cream px-5 pb-12 pt-10 sm:px-8 lg:col-span-7 lg:border-b-0 lg:border-r lg:px-14 lg:pb-14 lg:pt-12">
            <span aria-hidden className="texture-cream pointer-events-none absolute inset-0 opacity-30" />
            {/* Orange seam marker, top of the split (owner design) */}
            <span aria-hidden className="absolute right-0 top-0 hidden h-2 w-8 bg-accent lg:block" />
            <div className="relative z-10 flex flex-1 flex-col justify-center">
              {left}
            </div>
            <div className="relative z-10 mt-10">
              <FooterCaption>{leftFooter}</FooterCaption>
            </div>
          </section>

          {/* Dark half */}
          <section
            className={`relative flex flex-col bg-carbon px-5 pb-12 pt-10 text-white sm:px-8 lg:col-span-5 lg:px-14 lg:pb-14 lg:pt-12 ${
              rightScroll ? 'lg:overflow-hidden' : 'overflow-hidden'
            }`}
          >
            <span aria-hidden className="texture-dark pointer-events-none absolute inset-0 opacity-40" />
            <div
              className={`relative z-10 flex min-h-0 flex-1 flex-col ${
                rightScroll ? 'lg:overscroll-contain lg:overflow-y-auto' : 'justify-center'
              }`}
            >
              {right}
            </div>
            <div className="relative z-10 mt-10">
              <FooterCaption dark>{rightFooter}</FooterCaption>
            </div>
          </section>
        </main>
        <RulesTicker />
      </div>
    );
  }

  const bothOpen = !collapsed.left && !collapsed.right;
  return (
    <div className="flex min-h-screen flex-col bg-carbon">
      <div className="relative">
        <Header />
      </div>
      <main
        ref={trackRef}
        className={`flex flex-1 flex-col lg:min-h-0 lg:flex-row ${dragging ? 'cursor-col-resize select-none' : ''}`}
      >
        {/* Cream pane */}
        <section
          style={{ width: isWide ? (collapsed.left ? COLLAPSED_W : collapsed.right ? undefined : `${leftPct}%`) : undefined }}
          className={`relative flex flex-col bg-cream px-5 pb-12 pt-10 sm:px-8 lg:pb-14 lg:pt-12 ${
            collapsed.right ? 'lg:min-w-0 lg:flex-1' : 'lg:flex-shrink-0'
          } ${collapsed.left ? 'lg:overflow-hidden lg:px-2' : 'lg:px-10'}`}
        >
          <span aria-hidden className="texture-cream pointer-events-none absolute inset-0 opacity-30" />
          <span aria-hidden className="absolute right-0 top-0 hidden h-2 w-8 bg-accent lg:block" />
          <PaneControls
            side="left"
            dark={false}
            selfCollapsed={collapsed.left}
            onCollapse={() => collapse('left')}
            onExpand={() => expand('left')}
          />
          <div className="relative z-10 flex flex-1 flex-col justify-center">
            {left}
          </div>
          {!collapsed.left && (
            <div className="relative z-10 mt-10">
              <FooterCaption>{leftFooter}</FooterCaption>
            </div>
          )}
        </section>

        {/* Drag handle */}
        {bothOpen && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Drag to resize panes"
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => setLeftPct(DEFAULT_PCT)}
            className="group relative hidden w-1 flex-shrink-0 cursor-col-resize touch-none bg-line-dark lg:block"
          >
            <span
              aria-hidden
              className={`absolute left-1/2 top-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 bg-accent transition-opacity ${
                dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            />
          </div>
        )}

        {/* Dark pane */}
        <section
          style={{ width: isWide && collapsed.right ? COLLAPSED_W : undefined }}
          className={`relative flex min-w-0 flex-1 flex-col bg-carbon px-5 pb-12 pt-10 text-white sm:px-8 lg:pb-14 lg:pt-12 ${
            collapsed.right ? 'lg:flex-none lg:overflow-hidden lg:px-2' : 'lg:px-10'
          }`}
        >
          <span aria-hidden className="texture-dark pointer-events-none absolute inset-0 opacity-40" />
          <PaneControls
            side="right"
            dark
            selfCollapsed={collapsed.right}
            onCollapse={() => collapse('right')}
            onExpand={() => expand('right')}
          />
          <div className="relative z-10 flex flex-1 flex-col justify-center">
            {right}
          </div>
          {!collapsed.right && (
            <div className="relative z-10 mt-10">
              <FooterCaption dark>{rightFooter}</FooterCaption>
            </div>
          )}
        </section>
      </main>
      <RulesTicker extra={tickerExtra} />
    </div>
  );
}
