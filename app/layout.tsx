import './globals.css'
import type { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'The Ujamaa Expo | March 20, 2026 - Los Angeles',
  description: 'Short activations. Real work. Open exchange.',
}

const TICKETS_URL = 'https://www.eventbrite.com/e/the-ujamaa-expo-mingle-plei-tickets-1984949722052?aff=oddtdtcreator'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Figtree:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
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
                className="bg-white text-black px-5 py-2 rounded-full text-sm font-semibold hover:bg-white/90 transition-colors"
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
