import './globals.css'
import './wp-blocks.css'
import type { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'The Ujamaa Expo | March 20, 2026 - Los Angeles',
  description: 'A live activation series built around action, clarity, and collective growth. March 20, 2026 — The Gathering Spot, Los Angeles.',
  openGraph: {
    title: 'The Ujamaa Expo',
    description: 'A live activation series built around action, clarity, and collective growth. March 20, 2026 — The Gathering Spot, Los Angeles.',
    url: 'https://ujamaaexpo.com',
    siteName: 'The Ujamaa Expo',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Ujamaa Expo',
    description: 'A live activation series built around action, clarity, and collective growth. March 20, 2026 — The Gathering Spot, Los Angeles.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

const TICKETS_URL = 'https://www.eventbrite.com/e/the-ujamaa-expo-mingle-plei-tickets-1984949722052?aff=oddtdtcreator'

async function getThemeCSS() {
  const res = await fetch(
    'https://hq.funkmedia.net/ujamaaexpo/wp-json/fm-styles/v1/theme.css',
    { next: { revalidate: 3600 } }
  )
  const raw = await res.text()
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'string' ? parsed : raw
  } catch {
    return raw
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const themeCSS = await getThemeCSS()

  return (
    <html lang="en">
      <head>
        {/* Google Tag Manager — hardcoded GTM ID, no user input */}
        <script dangerouslySetInnerHTML={{ __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-T4JZ2RHD');` }} />
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
            <a href="/">
              <Image src="/ujx-logo.png" alt="Ujamaa Expo" width={150} height={50} className="h-10 w-auto" />
            </a>
            <div className="flex items-center gap-6">
              <a href="/contact" className="text-white/80 hover:text-white text-sm font-medium transition-colors">
                Contact
              </a>
              <a
                href={TICKETS_URL}
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
            <Image src="/ujx-logo.png" alt="Ujamaa Expo" width={120} height={40} className="h-8 w-auto opacity-60" />
            <div className="flex items-center gap-6 text-sm">
              <a href="https://www.instagram.com/ujamaaexpo" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Instagram</a>
              <a href="mailto:info@ujamaaexpo.com" className="hover:text-white transition-colors">info@ujamaaexpo.com</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
