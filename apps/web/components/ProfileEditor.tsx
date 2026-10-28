'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN } from '@coding-arena/shared';

/**
 * Inline display-name editor (F02). Validation hints come from the shared
 * constants; the server re-validates and its verdict is the one that counts.
 * `arena:session-changed` keeps the header chip in sync after a save.
 */
export function ProfileEditor({
  currentName,
  onDone,
}: {
  currentName: string;
  onDone: () => void;
}) {
  const [value, setValue] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = value.trim();
  const length = trimmed.length;
  const inRange = length >= DISPLAY_NAME_MIN && length <= DISPLAY_NAME_MAX;

  const save = () => {
    if (!inRange || saving) return;
    setSaving(true);
    setError(null);
    fetch('/api/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: trimmed }),
    })
      .then(async (res) => {
        if (res.ok) {
          window.dispatchEvent(new Event('arena:session-changed'));
          router.refresh();
          onDone();
          return;
        }
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? 'The server rejected that name. Try another.');
        setSaving(false);
      })
      .catch(() => {
        setError('Network error — the name was not saved.');
        setSaving(false);
      });
  };

  return (
    <div className="max-w-md">
      <label
        htmlFor="display-name"
        className="mb-2 block font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted"
      >
        Display name
      </label>
      <div className="flex items-stretch border border-carbon/40 bg-white focus-within:border-accent">
        <input
          ref={inputRef}
          id="display-name"
          autoFocus
          value={value}
          maxLength={DISPLAY_NAME_MAX + 10} // soft cap; the counter explains the real limit
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') onDone();
          }}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-grotesk text-sm font-semibold text-carbon outline-none"
          aria-describedby="name-counter"
        />
        <span
          id="name-counter"
          className={`flex items-center whitespace-nowrap px-2 font-mono text-xs tracking-[0.05em] ${
            inRange ? 'text-muted' : 'text-accent'
          }`}
        >
          {length}/{DISPLAY_NAME_MAX}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={!inRange || saving}
          className="border-l border-carbon/40 bg-accent px-4 font-mono text-xs font-bold uppercase tracking-[0.1em] text-carbon transition-colors hover:bg-[#ff6231] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="border-l border-carbon/25 px-4 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted transition-colors hover:text-carbon"
        >
          Cancel
        </button>
      </div>
      <p className="mt-2 min-h-5 font-grotesk text-sm text-muted" role="status">
        {error ?? `Between ${DISPLAY_NAME_MIN} and ${DISPLAY_NAME_MAX} characters. Shown on your profile and in duels.`}
      </p>
    </div>
  );
}
