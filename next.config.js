/** @type {import('next').NextConfig} */
const nextConfig = {
  // Security: Limit request body size to 1MB (standard) / 4MB (actions)
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  // Security: CORS Headers
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" }, // Replace * with your domain in production
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ]
  },
  reactStrictMode: true,
  // Transpile Circle SDK to ensure it works with Next.js
  transpilePackages: ['@circle-fin/w3s-pw-web-sdk'],
  // Note: Next.js 14 requires Node 18+, but project is set to Node 16
  // If issues arise, consider downgrading to Next.js 13.x which supports Node 16
  webpack: (config, { isServer, webpack }) => {
    // Fix for QR code library compatibility
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Fix for Circle SDK dynamic import chunk loading issues
    // Prevent webpack from incorrectly code-splitting the Circle SDK
    if (!isServer) {
      // Ensure Circle SDK is handled as a single chunk with a proper name
      const originalSplitChunks = config.optimization?.splitChunks;
      if (originalSplitChunks) {
        config.optimization.splitChunks = {
          ...originalSplitChunks,
          cacheGroups: {
            ...originalSplitChunks.cacheGroups,
            // Dedicated chunk for Circle SDK with explicit name
            circleSdk: {
              test: /[\\/]node_modules[\\/]@circle-fin[\\/]w3s-pw-web-sdk[\\/]/,
              name: 'circle-sdk',
              chunks: 'async',
              priority: 30,
              enforce: true,
            },
          },
        };
      }

      // Ignore warnings about dynamic imports and source maps
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        { module: /node_modules\/@circle-fin\/w3s-pw-web-sdk/ },
        /Failed to parse source map/,
      ];
    }

    return config;
  },
};

module.exports = nextConfig;

