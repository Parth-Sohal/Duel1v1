'use client';

import { useEffect, useState } from 'react';

/**
 * Telemetry bar readout: REAL round-trip latency to the game server's health
 * probe (through the same-origin /api proxy), re-measured every 20 s. Nothing
 * simulated — if the engine is unreachable it says so instead of guessing.
 */
export function EngineLatency() {
  const [ms, setMs] = useState<number | null>(null);
  const [down, setDown] = useState(false);

  useEffect(() => {
    let alive = true;
    const ping = async () => {
      const started = performance.now();
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!alive) return;
        setDown(!res.ok);
        setMs(Math.round(performance.now() - started));
      } catch {
        if (!alive) return;
        setDown(true);
      }
    };
    ping();
    const timer = setInterval(ping, 20000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (down) {
    return <span className="font-mono text-xs tracking-[0.05em] text-accent">ENGINE UNREACHABLE</span>;
  }
  return (
    <span className="font-mono text-xs tracking-[0.05em] text-neutral-400">
      ENGINE LATENCY: {ms === null ? '—' : `${ms}ms`}
    </span>
  );
}
