import type { NextConfig } from 'next';

// Where the game server lives. The web app proxies /api/* to it so every
// browser request is same-origin — that keeps the session cookie first-party
// (Safari blocks third-party cookies, so calling onrender.com directly would
// break sign-in there).
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  // The shared package ships TypeScript source consumed directly by both apps.
  transpilePackages: ['@coding-arena/shared'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
