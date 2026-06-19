import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');
  const url = req.nextUrl;

  // Sadece root ve API rotalarını koruyalım (isteğe bağlı ayarlayabilirsiniz)
  if (url.pathname === '/' || url.pathname.startsWith('/api')) {
    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      const [user, pwd] = atob(authValue).split(':');

      const expectedUser = process.env.PANEL_USER || 'admin';
      const expectedPass = process.env.PANEL_PASS || 'freelance1234';

      if (user === expectedUser && pwd === expectedPass) {
        return NextResponse.next();
      }
    }

    url.pathname = '/api/auth';
    return new NextResponse('Auth required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Secure Area"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/api/:path*'],
};
