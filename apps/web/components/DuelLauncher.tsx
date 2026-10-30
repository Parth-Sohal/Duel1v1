'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Chip, Eyebrow, Headline, Stat } from './ui';

/**
 * The PLAY launcher (owner design: play-1-choose-format.png). Left = format +
 * difficulty selection, right = create room / join by invite code. Only real
 * options are interactive; later-iteration options render muted.
 */

const DIFFICULTIES = [
  { value: 'ANY', label: 'ANY', hint: 'Any difficulty' },
  { value: 'easy', label: 'EASY', hint: 'Easy problems only' },
  { value: 'medium', label: 'MEDIUM', hint: 'Medium problems only' },
  { value: 'hard', label: 'HARD', hint: 'Hard problems only' },
] as const;

type Difficulty = (typeof DIFFICULTIES)[number]['value'];

export function DuelLauncher({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<Difficulty>('ANY');
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createRoom = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/duels/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ difficulty: difficulty === 'ANY' ? null : difficulty }),
      });
      const data = (await res.json().catch(() => null)) as { room?: { inviteCode: string }; error?: string } | null;
      if (res.ok && data?.room) {
        router.push(`/duel/${data.room.inviteCode}`);
        return;
      }
      if (data?.error === 'already_in_match') setError('You already have a live duel — finish it first.');
      else setError('Could not create the room. Refresh and try again.');
    } catch {
      setError('Could not reach the arena. Check your connection.');
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/duels/rooms/${encodeURIComponent(code)}/join`, { method: 'POST' });
      const data = (await res.json().catch(() => null)) as { room?: { inviteCode: string }; error?: string } | null;
      if (res.ok && data?.room) {
        router.push(`/duel/${data.room.inviteCode}`);
        return;
      }
      if (data?.error === 'room_unavailable') setError('No live room with that code — check it or ask for a fresh invite.');
      else if (data?.error === 'room_full') setError('That room is already full (2 players).');
      else if (data?.error === 'already_in_match') setError('You already have a live duel — finish it first.');
      else setError('Could not join. Refresh and try again.');
    } catch {
      setError('Could not reach the arena. Check your connection.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="grid w-full grid-cols-1 lg:grid-cols-2">
      {/* Cream half — format */}
      <section className="flex min-h-[60vh] flex-col justify-between border-b border-line-light px-5 py-10 sm:px-8 lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r lg:px-12">
        <div>
          <div className="mb-6">
            <Eyebrow marker="square">Step 1 · Choose a format</Eyebrow>
          </div>
          <Headline className="mb-8">Pick a duel.</Headline>

          <div className="mb-8 max-w-md space-y-4">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted">Opponent</p>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                className="border border-carbon bg-carbon px-3 py-4 font-mono text-xs font-bold uppercase tracking-[0.1em] text-cream"
                aria-pressed="true"
              >
                Rival
              </button>
              <span
                title="Arrives in a later iteration"
                className="flex cursor-not-allowed items-center justify-center border border-line-light bg-sand/40 px-3 py-4 font-mono text-xs font-bold uppercase tracking-[0.1em] text-muted"
              >
                Anyone
              </span>
              <span
                title="Arrives in a later iteration"
                className="flex cursor-not-allowed items-center justify-center border border-line-light bg-sand/40 px-3 py-4 font-mono text-xs font-bold uppercase tracking-[0.1em] text-muted"
              >
                Kern bot
              </span>
            </div>
            <p className="font-grotesk text-xs text-muted">
              Rival = a friend you invite with a code. Same problem, fastest correct solution wins.
            </p>
          </div>

          <div className="mb-8 max-w-md space-y-4">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted">Difficulty</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDifficulty(d.value)}
                  aria-pressed={difficulty === d.value}
                  title={d.hint}
                  className={`px-3 py-4 font-mono text-xs font-bold uppercase tracking-[0.1em] transition-colors ${
                    difficulty === d.value
                      ? 'bg-accent text-carbon'
                      : 'border border-carbon/25 bg-sand/60 text-carbon hover:bg-sand'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid max-w-md grid-cols-2 gap-x-8 gap-y-6">
            <Stat label="Format" value="1v1" />
            <Stat label="Clock" value="10 MIN" />
            <Stat label="Win swing" value="+29..31" />
            <Stat label="Draw" value="-10 both" />
          </div>
        </div>
        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
          Matched by invite / decided by the server
        </p>
      </section>

      {/* Dark half — your match */}
      <section className="flex min-h-[60vh] flex-col justify-between bg-carbon px-5 py-10 text-cream sm:px-8 lg:min-h-[calc(100vh-4rem)] lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6">
            <Eyebrow dark marker="notch">
              Your match
            </Eyebrow>
          </div>
          <h2 className="mb-3 font-headline text-4xl font-extrabold uppercase tracking-tight text-cream">
            {displayName.split(' ')[0]}&rsquo;s duel.
          </h2>
          <p className="mb-10 font-grotesk text-sm leading-relaxed text-neutral-300">
            Create a room and send the invite code to a friend — or paste a code you were sent. You both ready up,
            the host starts, and the clock decides the rest.
          </p>

          <button
            type="button"
            onClick={createRoom}
            disabled={creating}
            className="w-full bg-accent px-6 py-5 font-mono text-sm font-bold uppercase tracking-[0.15em] text-carbon transition-colors hover:bg-[#ff6231] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? 'Working…' : 'Create room'}
          </button>

          <div className="my-8 flex items-center gap-4">
            <span aria-hidden className="h-px flex-1 bg-line-dark" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">or join</span>
            <span aria-hidden className="h-px flex-1 bg-line-dark" />
          </div>

          <div className="flex gap-3">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              placeholder="INVITE CODE"
              maxLength={9}
              spellCheck={false}
              aria-label="Invite code"
              className="min-w-0 flex-1 border border-line-dark bg-surface px-4 py-3.5 font-mono text-sm font-bold uppercase tracking-[0.2em] text-cream outline-none placeholder:text-neutral-600 focus:border-accent"
            />
            <button
              type="button"
              onClick={joinRoom}
              disabled={creating || joinCode.trim().length === 0}
              className="flex-shrink-0 border border-line-dark bg-surface px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-cream transition-colors hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Join
            </button>
          </div>

          {error && <p className="mt-4 font-grotesk text-sm text-accent">{error}</p>}

          <div className="mt-12 border border-line-dark p-4">
            <div className="mb-2 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-neutral-300">
              <span aria-hidden className="inline-block h-1.5 w-1.5 bg-accent" />
              House rules
            </div>
            <ul className="space-y-1.5 font-grotesk text-sm leading-relaxed text-neutral-400">
              <li>Same problem, same 10-minute clock. First accepted submission wins.</li>
              <li>Win: +29 to +31, loser loses the same. Draw (clock out): −10 both.</li>
              <li>Leave mid-duel: the stayer gains +10, the leaver loses 10.</li>
              <li>Points can go below zero. Disconnect grace: 30 seconds.</li>
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Chip variant="dark">Server referee</Chip>
            <Chip variant="dark">Judge0 sandbox</Chip>
            <Chip variant="dark">JS · PY</Chip>
          </div>
        </div>
        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.1em] text-neutral-500">
          Rating changes only when the match ends.
        </p>
      </section>
    </div>
  );
}
