'use client';

import { useState } from 'react';
import { ProfileEditor } from './ProfileEditor';
import { Headline } from './ui';

/**
 * The profile headline with an inline edit toggle. The name itself is
 * server-rendered; the editor only appears on demand (F02: edit mode with
 * a character counter, save/cancel).
 */
export function ProfileName({ displayName }: { displayName: string }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <ProfileEditor currentName={displayName} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <Headline className="min-w-0 text-[clamp(2.5rem,6vw,4.5rem)]">{displayName}</Headline>
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Edit display name"
        aria-label="Edit display name"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center border border-line-light bg-sand/60 font-mono text-xs font-bold text-carbon transition-colors hover:border-accent hover:text-accent"
      >
        EDIT
      </button>
    </div>
  );
}
