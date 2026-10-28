'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AVATAR_MAX_BYTES, AVATAR_SIZE_PX } from '@coding-arena/shared';

/**
 * Avatar upload controls (F02b). The file is center-cropped to a 256×256
 * square on a canvas BEFORE upload, so rows stay tiny and no server-side
 * image processing is needed. The server re-validates; its verdict counts.
 * `arena:session-changed` keeps the header chip in sync after a change.
 */
export function AvatarEditor({ hasPhoto }: { hasPhoto: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  /** Center-crop to a square, scale to 256px, export as JPEG data URL. */
  const resizeToSquare = (file: File): Promise<string | null> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new window.Image();
        img.onload = () => {
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          const canvas = document.createElement('canvas');
          canvas.width = AVATAR_SIZE_PX;
          canvas.height = AVATAR_SIZE_PX;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => resolve(null);
        img.src = String(reader.result);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

  const pick = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    setBusy(true);
    const dataUrl = await resizeToSquare(file);
    if (!dataUrl) {
      setError('That image could not be read.');
      setBusy(false);
      return;
    }
    if (Math.ceil((dataUrl.length - 22) * 0.75) > AVATAR_MAX_BYTES) {
      setError('That image is too large even after resizing.');
      setBusy(false);
      return;
    }
    fetch('/api/me/avatar', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dataUrl }),
    })
      .then(async (res) => {
        if (res.ok) {
          window.dispatchEvent(new Event('arena:session-changed'));
          router.refresh();
          setBusy(false);
          return;
        }
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? 'The server rejected that image.');
        setBusy(false);
      })
      .catch(() => {
        setError('Network error — the photo was not saved.');
        setBusy(false);
      });
  };

  const remove = () => {
    setBusy(true);
    setError(null);
    fetch('/api/me/avatar', { method: 'DELETE' })
      .then(async (res) => {
        if (res.ok) {
          window.dispatchEvent(new Event('arena:session-changed'));
          router.refresh();
          setBusy(false);
          return;
        }
        setError('The photo could not be removed. Try again.');
        setBusy(false);
      })
      .catch(() => {
        setError('Network error — the photo was not removed.');
        setBusy(false);
      });
  };

  const btn =
    'flex items-center justify-center border border-line-light bg-sand/60 px-2.5 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-carbon transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = ''; // allow re-picking the same file
        }}
      />
      <button type="button" className={btn} disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Saving…' : 'Change photo'}
      </button>
      {hasPhoto && (
        <button type="button" className={btn} disabled={busy} onClick={remove}>
          Remove
        </button>
      )}
      {error && (
        <p role="alert" className="max-w-52 border border-accent/40 bg-accent/10 p-2 font-grotesk text-sm text-carbon">
          {error}
        </p>
      )}
    </div>
  );
}
