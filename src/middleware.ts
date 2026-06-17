import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname;
    const role = req.nextauth.token?.role;
    console.log(`[MIDDLEWARE DIAGNOSTIC] Path: ${pathname}, Role: ${role}, Authorized: true`);
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        const role = token?.role;
        const hasToken = !!token;
        console.log(`[MIDDLEWARE DIAGNOSTIC] Path: ${pathname}, Role: ${role}, HasToken: ${hasToken}`);
        
        if (!hasToken) {
          return false;
        }

        // Role-based restrictions
        if (pathname.startsWith('/super-admin')) {
          return role === 'SUPER_ADMIN';
        }

        if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
          return role === 'ADMIN' || role === 'SUPER_ADMIN';
        }

        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    '/admin/:path*',
    '/super-admin/:path*',
    '/dashboard/:path*',
    '/api/admin/:path*',
    '/api/security/:path*',
  ],
};
