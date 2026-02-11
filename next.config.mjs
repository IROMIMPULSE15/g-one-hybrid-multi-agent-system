/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable production optimizations
  reactStrictMode: true,
  productionBrowserSourceMaps: false,

  // Enable standalone mode for Docker
  output: 'standalone',

  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60,
    unoptimized: false,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Enable experimental features
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
    turbopack: {},
  },

  // Compression and caching
  compress: true,
  generateEtags: true,
  poweredByHeader: false,

  // Keep development checks
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;