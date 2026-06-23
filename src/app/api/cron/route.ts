import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { clients, payments, settings, vaultTransactions } from '@/db/schema';

export async function GET(req: NextRequest) {
  // Check Vercel Cron header to secure this endpoint
  const authHeader = req.headers.get('authorization');
  const cronHeader = req.headers.get('x-vercel-cron');

  // If you want to secure it, Vercel sends a specific authorization header matching your CRON_SECRET
  // For now, we will just allow it if it's called by cron, or allow local testing.
  if (process.env.NODE_ENV === 'production' && !cronHeader) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // 1. Get Telegram settings
    const allSettings = await db.select().from(settings);
    const tokenSetting = allSettings.find(s => s.key === 'telegram_bot_token');
    const chatSetting = allSettings.find(s => s.key === 'telegram_chat_id');

    const token = tokenSetting?.value;
    const chatId = chatSetting?.value;

    if (!token || !chatId) {
      console.log('Cron Backup: Telegram Bot Token or Chat ID is missing. Skipping.');
      return new NextResponse('Missing Telegram credentials', { status: 200 });
    }

    // 2. Fetch all data
    const allClients = await db.select().from(clients);
    const allPayments = await db.select().from(payments);
    const allVaultTx = await db.select().from(vaultTransactions);

    const backupData = {
      date: new Date().toISOString(),
      clients: allClients,
      payments: allPayments,
      settings: allSettings,
      vaultTransactions: allVaultTx,
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const fileName = `freepay-backup-${new Date().toISOString().split('T')[0]}.json`;

    // 3. Send to Telegram using sendDocument
    const url = `https://api.telegram.org/bot${token}/sendDocument`;
    
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('caption', '📦 FreePay Sistem Yedeği (Otomatik)\n\nTarih: ' + new Date().toLocaleString('tr-TR'));
    
    // Create a Blob from the JSON string
    const fileBlob = new Blob([jsonStr], { type: 'application/json' });
    formData.append('document', fileBlob, fileName);

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const result = await res.json();
    if (!result.ok) {
      console.error('Telegram backup failed:', result);
      return new NextResponse('Telegram API Error: ' + result.description, { status: 500 });
    }

    return new NextResponse('Backup sent successfully', { status: 200 });
  } catch (error: any) {
    console.error('Cron Error:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
