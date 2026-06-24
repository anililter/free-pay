import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/index.php',
        destination: '/api/legacy',
      },
    ];
  },
};

export default nextConfig;
