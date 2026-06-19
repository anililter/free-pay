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
      const period = url.searchParams.get('period');
      const allClients = await db.select().from(clients).orderBy(asc(clients.paymentDay));
      
      const allPayments = period 
        ? await db.select().from(payments).where(eq(payments.period, period))
        : await db.select().from(payments);
      
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

      return NextResponse.json({ 
        success: true, 
        clients: formattedClients, 
        data: formattedPayments,
        account_options: [],
        monthly_stats: { labels: [], datasets: [] },
        account_stats: { labels: [], datasets: [] },
        delay_stats: { delayedAmount: 0, criticalCount: 0 },
        report_metrics: { totalPaid: 0, expectedTotal: 0, pendingCount: 0 },
        client_earnings: []
      });
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
    const insertData = await req.json();

    if (api === 'client_create') {
        const newClient = await db.insert(clients).values({
            name: insertData.name,
            projectName: insertData.project_name,
            agreedAmount: parseFloat(insertData.agreed_amount || 0),
            currency: insertData.currency || 'TRY',
            paymentDay: parseInt(insertData.payment_day || 1),
            paymentType: insertData.payment_type || 'Aylık',
            status: insertData.status || 'aktif',
            agreementDate: insertData.agreement_date || insertData.start_date || new Date().toISOString().split('T')[0],
            startDate: insertData.start_date || new Date().toISOString().split('T')[0],
            notes: insertData.notes || '',
            accountInfo: insertData.account_info || '',
            source: 'Direct',
            referredById: null
        }).returning();

        return NextResponse.json({ success: true, client_id: newClient[0].id });
    }

    if (api === 'client_update') {
        const clientId = parseInt(insertData.id);
        await db.update(clients).set({
            name: insertData.name,
            projectName: insertData.project_name,
            agreedAmount: parseFloat(insertData.agreed_amount || 0),
            currency: insertData.currency || 'TRY',
            paymentDay: parseInt(insertData.payment_day || 1),
            paymentType: insertData.payment_type || 'Aylık',
            status: insertData.status || 'aktif',
            agreementDate: insertData.agreement_date || insertData.start_date || new Date().toISOString().split('T')[0],
            startDate: insertData.start_date || new Date().toISOString().split('T')[0],
            notes: insertData.notes || '',
            accountInfo: insertData.account_info || ''
        }).where(eq(clients.id, clientId));

        return NextResponse.json({ success: true });
    }

    if (api === 'client_delete') {
        const clientId = parseInt(insertData.id);
        await db.delete(clients).where(eq(clients.id, clientId));
        return NextResponse.json({ success: true });
    }

    if (api === 'save_inline') {
        const clientId = parseInt(insertData.client_id);
        const period = insertData.period;
        const field = insertData.field;
        let value = insertData.value;

        // Check if payment exists for this period
        const existing = await db.select().from(payments)
            .where(and(eq(payments.clientId, clientId), eq(payments.period, period)));

        let paymentId;
        if (existing.length === 0) {
            const newPayment = await db.insert(payments).values({
                clientId: clientId,
                period: period,
                amount: 0,
                status: 'pending',
                currency: 'TRY', 
                dueDate: new Date().toISOString().split('T')[0]
            }).returning();
            paymentId = newPayment[0].id;
        } else {
            paymentId = existing[0].id;
        }

        const updates: any = {};
        
        if (field === 'amount_paid') updates.amount = parseFloat(value || 0);
        else if (field === 'status') {
            updates.status = value;
            if (value === 'ödendi') updates.paidDate = new Date().toISOString().split('T')[0];
            else if (value === 'pending' || value === 'gecikti') updates.paidDate = null;
        }
        else if (field === 'notes') updates.periodNotes = value;
        else if (field === 'account_info') updates.accountInfo = value;
        else if (field === 'status_with_date') {
            try {
                const parsed = JSON.parse(value);
                updates.status = parsed.status;
                updates.paidDate = parsed.paid_date;
            } catch(e) {}
        }

        if (Object.keys(updates).length > 0) {
            await db.update(payments).set(updates).where(eq(payments.id, paymentId));
        }

        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unknown API endpoint' }, { status: 400 });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
