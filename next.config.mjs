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
    // Allow ngrok and local URLs to resolve CORS warning
    allowedDevOrigins: [
      'https://*.ngrok-free.app',
      'https://e1a30ddc87c6.ngrok-free.app',
      'http://localhost:3000',
      'http://192.168.56.1:3000',
      'http://<your-public-ip>:3000', // Replace with your public IP (e.g., 203.0.113.x)
    ],
    optimizeCss: true,
    scrollRestoration: true,
    webpackBuildWorker: true,
  },

  // Compression and caching
  compress: true,
  generateEtags: true,
  poweredByHeader: false,

  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Enable top-level await
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };

    // Production optimizations
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        minimize: true,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          cacheGroups: {
            default: false,
            vendors: false,
          },
        },
      };
    }

    return config;
  },

  // Compress responses
  compress: true,

  // Optimize build output
  output: 'standalone',

  // Keep development checks
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;