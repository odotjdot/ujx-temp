/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'hq.funkmedia.net' },
    ],
  },
}
module.exports = nextConfig
