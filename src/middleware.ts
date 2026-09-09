import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Proteksi khusus rute Admin (Halaman & API)
    const isAdminPageRoute =
      pathname.startsWith('/users') ||
      pathname.startsWith('/logs') ||
      pathname.startsWith('/accounts');

    const isAdminApiRoute =
      pathname.startsWith('/api/users') ||
      pathname.startsWith('/api/logs') ||
      (pathname.startsWith('/api/accounts') && req.method !== 'GET');

    // Pembatasan unit lain untuk role CATERING
    const isOtherUnitPageRoute =
      pathname.startsWith('/units/molen') ||
      pathname.startsWith('/units/wifi') ||
      pathname.startsWith('/units/ppob') ||
      pathname.startsWith('/units/sapi');

    const isOtherUnitApiRoute =
      pathname.startsWith('/api/units/molen') ||
      pathname.startsWith('/api/units/wifi') ||
      pathname.startsWith('/api/units/ppob') ||
      pathname.startsWith('/api/units/sapi');

    // Jika bukan ADMIN (misal CATERING) mencoba akses fitur admin
    if (token?.role !== 'ADMIN') {
      if (isAdminApiRoute) {
        return NextResponse.json(
          { error: 'Akses ditolak: Memerlukan hak akses Administrator / Sekretaris Desa' },
          { status: 403 }
        );
      }
      if (isAdminPageRoute) {
        return NextResponse.redirect(new URL(token?.role === 'CATERING' ? '/units/catering' : '/', req.url));
      }
    }

    // Jika role CATERING mencoba akses unit usaha lain atau beranda konsolidasi
    if (token?.role === 'CATERING') {
      if (isOtherUnitApiRoute) {
        return NextResponse.json(
          { error: 'Akses ditolak: Pengurus Catering hanya memiliki akses ke unit Catering' },
          { status: 403 }
        );
      }
      if (isOtherUnitPageRoute || pathname === '/') {
        return NextResponse.redirect(new URL('/units/catering', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (NextAuth endpoints)
     * - login (auth page)
     * - static files (_next/static, _next/image, favicon.ico, logo.png, fonts)
     */
    '/((?!api/auth|login|_next/static|_next/image|favicon.ico|logo.png|fonts).*)',
  ],
};
