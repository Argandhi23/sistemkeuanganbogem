import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Proteksi khusus rute Admin
    const isAdminRoute =
      pathname.startsWith('/users') ||
      pathname.startsWith('/logs') ||
      pathname.startsWith('/accounts');

    if (isAdminRoute && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', req.url));
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
