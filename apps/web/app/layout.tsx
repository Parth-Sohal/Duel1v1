import type { Metadata } from 'next';
import { Anton, Barlow_Condensed, IBM_Plex_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { APP_NAME } from '@coding-arena/shared';
import './globals.css';

// Fonts per docs/ui/design-tokens.md §2.
const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap',
});

const barlow = Barlow_Condensed({
  weight: ['600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-barlow',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-plex-mono',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Two players, one challenge, ten minutes. Race to pass all tests.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${barlow.variable} ${plexMono.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
