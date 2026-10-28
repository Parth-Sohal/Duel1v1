import Image from 'next/image';

/**
 * Player avatar. Sources, in order: an uploaded photo (local `/api/...`
 * URL, F02b), a Google-hosted picture, or the first letter on a solid
 * block. Fixed sizes keep the brutalist grid intact.
 */
export function Avatar({
  displayName,
  avatarUrl,
  size = 96,
  className = '',
}: {
  displayName: string;
  avatarUrl: string | null;
  size?: number;
  className?: string;
}) {
  if (avatarUrl) {
    const local = avatarUrl.startsWith('/');
    return (
      <span
        className={`relative inline-block flex-shrink-0 overflow-hidden border border-line-light bg-sand ${className}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={avatarUrl}
          alt={`${displayName}'s avatar`}
          fill
          sizes={`${size}px`}
          loading="eager" // tiny images, always above the fold — lazy never paints
          unoptimized={local} // local bytes are already 256px — skip the optimizer round-trip
          referrerPolicy="no-referrer"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`flex flex-shrink-0 items-center justify-center border border-line-light bg-carbon font-headline font-extrabold text-cream ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {displayName.charAt(0).toUpperCase()}
    </span>
  );
}
