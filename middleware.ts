// Edge auth middleware scaffold (disabled by default via env flag)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Feature flag: set NEXT_PUBLIC_ENABLE_EDGE_AUTH=true to enable
  const enabled = process.env.NEXT_PUBLIC_ENABLE_EDGE_AUTH === 'true';
  if (!enabled) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  // Allow unauthenticated access to login, static and api reset-password route
  const publicPaths = [
    '/login',
    '/_next',
    '/favicon.ico',
    '/api/users/reset-password',
  ];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Expect a Firebase session cookie set by server (not yet enforced here)
  const sessionCookie = request.cookies.get('__session')?.value;
  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static assets implicitly
  matcher: ['/((?!_next/static|_next/image|.*\.(?:png|jpg|jpeg|svg|gif|ico|css|js|mp3)).*)'],
};






