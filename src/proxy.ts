import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function proxy(req: NextRequest) {
  const basicAuth = req.headers.get('authorization');
  const url = req.nextUrl;

  // Sadece root ve API rotalarını koruyalım (isteğe bağlı ayarlayabilirsiniz)
  if (url.pathname === '/' || url.pathname === '/admin.html' || url.pathname.startsWith('/api')) {
    if (basicAuth) {
      try {
        const authValue = basicAuth.split(' ')[1];
        const [user, pwd] = atob(authValue).split(':');

        const expectedUser = process.env.PANEL_USER || 'admin';
        const expectedPass = process.env.PANEL_PASS || 'freelance1234';

        if (user === expectedUser && pwd === expectedPass) {
          return NextResponse.next();
        }

        // DB check
        const [dbUser] = await db.select().from(users).where(eq(users.username, user));
        if (dbUser && dbUser.password === pwd) {
          return NextResponse.next();
        }
      } catch (e) {
        console.error('Auth error:', e);
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
  matcher: ['/', '/admin.html', '/api/:path*'],
};
