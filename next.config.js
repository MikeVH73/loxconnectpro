/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['firebasestorage.googleapis.com'],
  },
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyD3LGcmPieAnJuGrNUyIRTQw3bQ1Gzsjj0",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "loxconnect-pro.firebaseapp.com",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "loxconnect-pro",
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "loxconnect-pro.firebasestorage.app",
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "767888928675",
    NEXT_PUBLIC_FIREBASE_APP_ID: "1:767888928675:web:e4c6bb3914fc97ecf4b416",
  },
  webpack: (config, { isServer }) => {
    // Ignore specific modules that cause issues with SSR
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
  experimental: {
    isrMemoryCacheSize: 0, // Disable ISR caching
  },
}

module.exports = nextConfig;
