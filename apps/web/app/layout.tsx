import type { Metadata } from 'next';
import { APP_NAME } from '@coding-arena/shared';
import './globals.css';

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Two players, one challenge, ten minutes. Race to pass all tests.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
