/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions are enabled by default in Next 14; typed routes optional.
    typedRoutes: false,
  },
};

export default nextConfig;
