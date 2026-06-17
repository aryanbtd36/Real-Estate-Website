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
        return hasToken;
      },
    },
  }
);

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
  ],
};
