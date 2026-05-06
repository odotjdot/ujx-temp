import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname.startsWith('/console') && pathname !== '/console/login') {
    if (!req.cookies.get('console-id-token')?.value) {
      const url = req.nextUrl.clone(); url.pathname = '/console/login'; url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }
  if (pathname.startsWith('/dashboard')) {
    if (!req.cookies.get('dashboard-id-token')?.value) {
      const url = req.nextUrl.clone(); url.pathname = '/login'; url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }
  return NextResponse.next()
}

export const config = { matcher: ['/console/:path*', '/dashboard/:path*'] }