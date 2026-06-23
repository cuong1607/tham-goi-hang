/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tắt body parser mặc định để dùng formData
  experimental: {
    serverComponentsExternalPackages: ['xlsx', 'better-sqlite3', 'sharp', '@resvg/resvg-js'],
    outputFileTracingIncludes: {
      '/api/bali-to-images/generate': ['./fonts/**/*'],
    },
  },
}

module.exports = nextConfig
