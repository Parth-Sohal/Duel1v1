import type { Metadata } from 'next';
import { Syne, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// Fonts from the owner's brutalist login design (2026-10-27).
const syne = Syne({
  weight: ['700', '800'],
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});

const grotesk = Space_Grotesk({
  weight: ['500', '700'],
  subsets: ['latin'],
  variable: '--font-grotesk',
  display: 'swap',
});

const jbMono = JetBrains_Mono({
  weight: ['400', '500', '700', '800'],
  subsets: ['latin'],
  variable: '--font-jbmono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: '{ duel } — Coding Arena',
    template: '%s — { duel }',
  },
  description: 'Two players, one challenge, ten minutes. Race to pass all tests.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${grotesk.variable} ${jbMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
