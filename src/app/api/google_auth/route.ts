import { NextResponse } from 'next/server';
import { db } from '@/db';
import { settings } from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  const allSettings = await db.select().from(settings);
  const findVal = (key: string) => allSettings.find(s => s.key === key)?.value || null;

  const clientId = process.env.GOOGLE_CLIENT_ID || findVal('google_client_id');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || findVal('google_base_url') || 'https://paymentsystem-iota.vercel.app';
  const redirectUri = `${baseUrl}/api/google_callback`;

  if (!clientId) {
    return NextResponse.json({ 
      error: 'GOOGLE_CLIENT_ID not configured in env or settings table'
    }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/tasks',
    access_type: 'offline',
    prompt: 'consent',
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
