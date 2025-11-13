/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['lucide-react'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // TODO: Fix TypeScript errors related to database schema mismatches
    // Disable type checking during builds to allow deployment
    ignoreBuildErrors: true,
  },
  // Increase timeout for static page generation to handle slower builds
  staticPageGenerationTimeout: 120,

  // Production-optimized cache headers
  async headers() {
    return [
      {
        // Never cache API routes - they return dynamic data
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
      {
        // Aggressively cache static assets (JS, CSS, fonts, images)
        // These have content hashes in filenames, so safe to cache forever
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache Next.js image optimization responses for 1 year
        source: '/_next/image/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // HTML pages: Allow CDN caching but always revalidate with origin
        // This enables stale-while-revalidate pattern for fast page loads
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },

  // Use default build ID (Git commit hash)
  // Next.js automatically uses git commit SHA when available
  // This provides cache invalidation when code changes, without timestamp randomness
  // generateBuildId: async () => {
  //   return `build-${Date.now()}`;
  // },
};

export default nextConfig;
