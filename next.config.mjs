/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['lucide-react'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
