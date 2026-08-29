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

    if (token?.role !== 'ADMIN') {
      if (isAdminApiRoute) {
        return NextResponse.json(
          { error: 'Akses ditolak: Memerlukan hak akses Administrator' },
          { status: 403 }
        );
      }
      if (isAdminPageRoute) {
        return NextResponse.redirect(new URL('/', req.url));
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
