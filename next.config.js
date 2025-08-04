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
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env?.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  compiler: {
    removeConsole: process.env?.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  }
}

module.exports = nextConfig;