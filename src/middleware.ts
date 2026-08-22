import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Proteksi Halaman Khusus ADMIN
    if (
      pathname.startsWith('/users') ||
      pathname.startsWith('/logs') ||
      pathname.startsWith('/accounts') ||
      pathname.startsWith('/api/users') ||
      pathname.startsWith('/api/logs')
    ) {
      if (token?.role !== 'ADMIN') {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'Akses ditolak. Fitur ini khusus untuk Administrator.' },
            { status: 403 }
          );
        }
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
    '/',
    '/transaksi/:path*',
    '/laporan/:path*',
    '/accounts/:path*',
    '/users/:path*',
    '/logs/:path*',
    '/bantuan/:path*',
    '/api/transaksi/:path*',
    '/api/accounts/:path*',
    '/api/users/:path*',
    '/api/logs/:path*',
    '/api/sync/:path*',
    '/api/dashboard/:path*',
    '/api/laporan/:path*',
  ],
};
