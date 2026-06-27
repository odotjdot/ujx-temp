/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'hq.funkmedia.net' },
    ],
  },
  allowedDevOrigins: ['ujx.test', '*.ujx.test'],
}
module.exports = nextConfig
