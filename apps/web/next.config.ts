import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The shared package ships TypeScript source consumed directly by both apps.
  transpilePackages: ['@coding-arena/shared'],
};

export default nextConfig;
