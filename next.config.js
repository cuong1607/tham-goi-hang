/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tắt body parser mặc định để dùng formData
  experimental: {
    serverComponentsExternalPackages: ['xlsx'],
  },
}

module.exports = nextConfig
