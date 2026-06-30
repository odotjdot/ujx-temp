/** @type {import('next').NextConfig} */
const _wpUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL
const _wpHostname = _wpUrl ? new URL(_wpUrl).hostname : null
if (!_wpHostname) console.warn('[next.config] NEXT_PUBLIC_WORDPRESS_URL not set — images.remotePatterns will be empty')

const nextConfig = {
  output: 'standalone',
  // mysql2 uses native bindings; must be external so it lands in the standalone bundle.
  serverExternalPackages: ['mysql2'],
  images: {
    remotePatterns: _wpHostname
      ? [{ protocol: 'https', hostname: _wpHostname }]
      : [],
  },
  allowedDevOrigins: ['ujx.test', '*.ujx.test'],
}
module.exports = nextConfig
