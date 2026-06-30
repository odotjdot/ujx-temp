import './globals.css'
import './wp-blocks.css'
import type { Metadata } from 'next'
import Image from 'next/image'
import { getThemeCSS } from '@/lib/theme'

// ─── Brand config — env with ujx fallback defaults; forks override via env ───
const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || 'The Ujamaa Expo'
const BRAND_LOGO_URL = process.env.NEXT_PUBLIC_BRAND_LOGO_URL || '/ujx-logo.png'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ujamaaexpo.com'
const CTA_URL = process.env.NEXT_PUBLIC_CTA_URL || 'https://www.eventbrite.com/e/the-ujamaa-expo-mingle-plei-tickets-1984949722052?aff=oddtdtcreator'
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || 'GTM-T4JZ2RHD'
const SOCIAL_INSTAGRAM = process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || 'https://www.instagram.com/ujamaaexpo'
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'info@ujamaaexpo.com'
const NAV_SURFACES = new Set(
  (process.env.NEXT_PUBLIC_NAV_SURFACES || 'home,contact').split(',').map(s => s.trim())
)

const BRAND_DESCRIPTION = 'A live activation series built around action, clarity, and collective growth. March 20, 2026 — The Gathering Spot, Los Angeles.'

export const metadata: Metadata = {
  title: `${BRAND_NAME} | March 20, 2026 - Los Angeles`,
  description: BRAND_DESCRIPTION,
  openGraph: {
    title: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    url: SITE_URL,
    siteName: BRAND_NAME,
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const themeCSS = await getThemeCSS()
  // GTM_ID comes from NEXT_PUBLIC_GTM_ID (build-time env), not user input — safe for dangerouslySetInnerHTML
  const gtmScript = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`

  return (
    <html lang="en">
      <head>
        {/* Google Tag Manager */}
        <script dangerouslySetInnerHTML={{ __html: gtmScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Figtree:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <script src="https://www.google.com/recaptcha/api.js?render=6LecXY8sAAAAANqi4AO2T2f5wb2ltOpU-KgTwPXZ" async defer></script>
        {/* SECURITY: Theme CSS compiled by wp_get_global_stylesheet() on our WP server — CSS only, no user content */}
        <style id="wp-global-styles">{themeCSS}</style>
      </head>
      <body className="relative">
        <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-sm border-b border-white/10">
          <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
            {NAV_SURFACES.has('home') && (
              <a href="/">
                <Image src={BRAND_LOGO_URL} alt={BRAND_NAME} width={150} height={50} className="h-10 w-auto" />
              </a>
            )}
            <div className="flex items-center gap-6">
              {NAV_SURFACES.has('contact') && (
                <a href="/contact" className="text-white/80 hover:text-white text-sm font-medium transition-colors">
                  Contact
                </a>
              )}
              <a
                href={CTA_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ backgroundColor: 'var(--wp--preset--color--primary, #ac323a)', color: '#fff', padding: '0.5rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}
              >
                Get Tickets
              </a>
            </div>
          </nav>
        </header>

        <main>{children}</main>

        <footer className="bg-black text-white/60 py-10 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <Image src={BRAND_LOGO_URL} alt={BRAND_NAME} width={120} height={40} className="h-8 w-auto opacity-60" />
            <div className="flex items-center gap-6 text-sm">
              <a href={SOCIAL_INSTAGRAM} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Instagram</a>
              <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white transition-colors">{CONTACT_EMAIL}</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
