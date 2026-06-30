/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // mysql2 uses native bindings; must be external so it lands in the standalone bundle.
  serverExternalPackages: ['mysql2'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'hq.funkmedia.net' },
    ],
  },
  allowedDevOrigins: ['ujx.test', '*.ujx.test'],
}
module.exports = nextConfig
