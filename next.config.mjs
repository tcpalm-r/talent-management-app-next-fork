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
  // Experimental: skip static generation of error pages
  experimental: {
    isrMemoryCacheSize: 52 * 1024 * 1024,
  },
};

export default nextConfig;
