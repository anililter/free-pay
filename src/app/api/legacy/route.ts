import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { clients, payments, settings } from '@/db/schema';
import { eq, and, sql, asc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const api = url.searchParams.get('api');

  try {
    if (api === 'clients_list') {
      const allClients = await db.select().from(clients).orderBy(asc(clients.paymentDay));
      const formattedClients = allClients.map(c => ({
        client_id: c.id,
        client_name: c.name,
        project_name: c.projectName,
        agreed_amount: c.agreedAmount,
        currency: c.currency,
        payment_day: c.paymentDay,
        payment_type: c.paymentType,
        default_account_info: c.accountInfo,
        client_status: c.status,
        start_date: c.startDate,
        client_notes: c.notes,
        source: c.source,
        referred_by_id: c.referredById
      }));
      return NextResponse.json({ success: true, data: formattedClients });
    }

    if (api === 'list') {
      const allClients = await db.select().from(clients).orderBy(asc(clients.paymentDay));
      const allPayments = await db.select().from(payments);
      
      const formattedClients = allClients.map(c => ({
        client_id: c.id,
        client_name: c.name,
        project_name: c.projectName,
        agreed_amount: c.agreedAmount,
        currency: c.currency,
        payment_day: c.paymentDay,
        payment_type: c.paymentType,
        default_account_info: c.accountInfo,
        client_status: c.status,
        start_date: c.startDate,
        client_notes: c.notes,
        source: c.source,
        referred_by_id: c.referredById
      }));

      const formattedPayments = allPayments.map(p => ({
        payment_id: p.id,
        client_id: p.clientId,
        payment_date: p.paidDate,
        amount_paid: p.amount,
        currency: p.currency,
        status: p.status,
        payment_type: 'Havale/EFT',
        notes: p.periodNotes,
        account_info: p.accountInfo,
        payment_period: p.period,
        receipt_url: '',
        is_carried_over: 0,
        carried_from_period: null
      }));

      return NextResponse.json({ success: true, clients: formattedClients, payments: formattedPayments });
    }

    return NextResponse.json({ success: false, error: 'Unknown API endpoint' }, { status: 400 });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const url = req.nextUrl;
  const api = url.searchParams.get('api');

  try {
    if (api === 'client_create') {
        const body = await req.formData();
        const insertData: any = {};
        for (const [key, value] of body.entries()) {
            insertData[key] = value;
        }

        const newClient = await db.insert(clients).values({
            name: insertData.client_name,
            projectName: insertData.project_name,
            agreedAmount: parseFloat(insertData.agreed_amount || 0),
            currency: insertData.currency || 'TRY',
            paymentDay: parseInt(insertData.payment_day || 1),
            paymentType: insertData.payment_type || 'Aylık',
            status: insertData.client_status || 'aktif',
            agreementDate: insertData.start_date || new Date().toISOString().split('T')[0],
            startDate: insertData.start_date || new Date().toISOString().split('T')[0],
            notes: insertData.client_notes || '',
            accountInfo: insertData.default_account_info || '',
            source: insertData.source || 'Direct',
            referredById: insertData.referred_by_id ? parseInt(insertData.referred_by_id) : null
        }).returning();

        return NextResponse.json({ success: true, client_id: newClient[0].id });
    }

    if (api === 'client_update') {
        const body = await req.formData();
        const insertData: any = {};
        for (const [key, value] of body.entries()) {
            insertData[key] = value;
        }
        
        const clientId = parseInt(insertData.client_id);
        await db.update(clients).set({
            name: insertData.client_name,
            projectName: insertData.project_name,
            agreedAmount: parseFloat(insertData.agreed_amount || 0),
            currency: insertData.currency || 'TRY',
            paymentDay: parseInt(insertData.payment_day || 1),
            paymentType: insertData.payment_type || 'Aylık',
            status: insertData.client_status || 'aktif',
            agreementDate: insertData.start_date || new Date().toISOString().split('T')[0],
            startDate: insertData.start_date || new Date().toISOString().split('T')[0],
            notes: insertData.client_notes || '',
            accountInfo: insertData.default_account_info || '',
            source: insertData.source || 'Direct',
            referredById: insertData.referred_by_id ? parseInt(insertData.referred_by_id) : null
        }).where(eq(clients.id, clientId));

        return NextResponse.json({ success: true });
    }

    if (api === 'client_delete') {
        const body = await req.formData();
        const clientId = parseInt(body.get('client_id') as string);
        await db.delete(clients).where(eq(clients.id, clientId));
        return NextResponse.json({ success: true });
    }

    if (api === 'save_inline') {
        const body = await req.formData();
        const clientId = parseInt(body.get('client_id') as string);
        const amountPaid = body.get('amount_paid') ? parseFloat(body.get('amount_paid') as string) : null;
        const status = body.get('status') as string;
        const period = body.get('period') as string;
        const notes = body.get('notes') as string;
        const accountInfo = body.get('account_info') as string;

        // Check if payment exists for this period
        const existing = await db.select().from(payments)
            .where(and(eq(payments.clientId, clientId), eq(payments.period, period)));

        if (existing.length > 0) {
            await db.update(payments).set({
                amount: amountPaid ?? 0,
                status: status,
                periodNotes: notes,
                accountInfo: accountInfo,
                paidDate: status === 'ödendi' ? new Date().toISOString().split('T')[0] : null
            }).where(eq(payments.id, existing[0].id));
        } else {
            await db.insert(payments).values({
                clientId: clientId,
                period: period,
                amount: amountPaid ?? 0,
                status: status,
                periodNotes: notes,
                accountInfo: accountInfo,
                paidDate: status === 'ödendi' ? new Date().toISOString().split('T')[0] : null,
                currency: 'TRY', // Default or read from client later
                dueDate: new Date().toISOString().split('T')[0]
            });
        }
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unknown API endpoint' }, { status: 400 });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
