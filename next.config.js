/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Note: Next.js 14 requires Node 18+, but project is set to Node 16
  // If issues arise, consider downgrading to Next.js 13.x which supports Node 16
  webpack: (config, { isServer }) => {
    // Fix for QR code library compatibility
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;

