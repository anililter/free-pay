import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { clients, payments, settings } from '@/db/schema';
import { eq, and, sql, asc, desc, gte, lte, inArray } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const TURKISH_MONTHS: Record<string, string> = {
  '01': 'Ocak',
  '02': 'Şubat',
  '03': 'Mart',
  '04': 'Nisan',
  '05': 'Mayıs',
  '06': 'Haziran',
  '07': 'Temmuz',
  '08': 'Ağustos',
  '09': 'Eylül',
  '10': 'Ekim',
  '11': 'Kasım',
  '12': 'Aralık',
};

/** Return the last day of a given year/month. */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Compute due‑date string for a client's paymentDay in a given period. */
function computeDueDate(period: string, paymentDay: number, paymentType: string = 'upfront'): string {
  let [y, m] = period.split('-').map(Number);
  if (paymentType === 'net30') {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  const last = lastDayOfMonth(y, m);
  const day = Math.min(paymentDay, last);
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Generate an array of period strings (YYYY-MM) from start to end inclusive. */
function generatePeriodRange(start: string, end: string): string[] {
  const periods: string[] = [];
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    periods.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return periods;
}

/** Turkish label for a period, e.g. "Ocak 2026" */
function turkishLabel(period: string): string {
  const [y, m] = period.split('-');
  return `${TURKISH_MONTHS[m] || m} ${y}`;
}

/** Difference in days between two date strings (YYYY-MM-DD). Positive means late. */
function daysDiff(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00Z');
  const b = new Date(dateB + 'T00:00:00Z');
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/** Check if a client's start_date falls on or before the last day of a period. */
function clientActiveInPeriod(startDate: string, period: string): boolean {
  const [y, m] = period.split('-').map(Number);
  const last = lastDayOfMonth(y, m);
  const periodEnd = `${period}-${String(last).padStart(2, '0')}`;
  return startDate <= periodEnd;
}

/** Check if a client's end_date has passed before the beginning of a period. */
function clientEndedBeforePeriod(endDate: string | null, period: string): boolean {
  if (!endDate) return false;
  const periodStart = `${period}-01`;
  return endDate < periodStart;
}

// ---------------------------------------------------------------------------
// Helpers for JSON responses
// ---------------------------------------------------------------------------

function ok(data: unknown) {
  return NextResponse.json({ success: true, ...((data && typeof data === 'object') ? data : { data }) });
}

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const api = url.searchParams.get('api');

  try {
    // -----------------------------------------------------------------------
    // clients_list
    // -----------------------------------------------------------------------
    if (api === 'clients_list') {
      const allClients = await db.select().from(clients).orderBy(asc(clients.paymentDay));

      // Count months with status = 'pasif' clients (passive_months = number of
      // currently‑passive clients)
      const passiveCount = allClients.filter((c) => c.status === 'pasif').length;

      const data = allClients.map((c) => ({
        id: c.id,
        name: c.name,
        project_name: c.projectName,
        agreed_amount: c.agreedAmount,
        currency: c.currency,
        payment_day: c.paymentDay,
        payment_type: c.paymentType,
        account_info: c.accountInfo,
        status: c.status,
        start_date: c.startDate,
        end_date: c.endDate,
        notes: c.notes,
        agreement_date: c.agreementDate,
        grace_period_days: c.gracePeriodDays,
        source: c.source,
      }));

      return ok({ data, passive_months: passiveCount });
    }

    // -----------------------------------------------------------------------
    // list  – main payments listing with stats
    // -----------------------------------------------------------------------
    if (api === 'list') {
      // Period range params
      let periodStart = url.searchParams.get('period_start');
      let periodEnd = url.searchParams.get('period_end');
      const legacyPeriod = url.searchParams.get('period');

      if (legacyPeriod && !periodStart && !periodEnd) {
        periodStart = legacyPeriod;
        periodEnd = legacyPeriod;
      }

      if (!periodStart || !periodEnd) {
        const now = new Date().toISOString().substring(0, 7);
        periodStart = periodStart || now;
        periodEnd = periodEnd || now;
      }

      // 1. Calculate the target date range for due_date
      const targetStartDate = `${periodStart}-01`;
      const [ey, em] = periodEnd.split('-').map(Number);
      const targetEndDate = `${periodEnd}-${String(lastDayOfMonth(ey, em)).padStart(2, '0')}`;

      // 2. Fetch active clients
      const activeClients = await db
        .select()
        .from(clients)
        .where(sql`${clients.startDate} <= ${targetEndDate}`)
        .orderBy(asc(clients.paymentDay));

      // 3. To find all virtual rows that might have a due_date in this range,
      // we check periods from (periodStart - 1 month) to periodEnd.
      const [sy, sm] = periodStart.split('-').map(Number);
      const prevMonth = sm === 1 ? 12 : sm - 1;
      const prevYear = sm === 1 ? sy - 1 : sy;
      const checkPeriodStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
      
      const periodsToCheck = generatePeriodRange(checkPeriodStart, periodEnd);

      // Fetch existing payments in these periods to avoid duplicates and to get actual dueDates
      const existingPayments = periodsToCheck.length > 0
        ? await db
            .select()
            .from(payments)
            .where(inArray(payments.period, periodsToCheck))
        : [];

      // Index payments by "clientId:period"
      const paymentIndex = new Map<string, typeof existingPayments[number]>();
      for (const p of existingPayments) {
        paymentIndex.set(`${p.clientId}:${p.period}`, p);
      }

      // Collect unique account options
      const accountSet = new Set<string>();

      // Build response data rows
      const data: Record<string, unknown>[] = [];
      const today = new Date().toISOString().substring(0, 10);
      const addedKeys = new Set<string>(); // to prevent duplicates if manual due dates shift things wildly

      // Add ALL payments that actually fall in the due_date range (from DB)
      for (const p of existingPayments) {
        if (p.dueDate >= targetStartDate && p.dueDate <= targetEndDate) {
          const c = activeClients.find(client => client.id === p.clientId);
          if (!c || c.status === 'pasif') continue; // Only active clients
          
          const accountInfo = p.accountInfo || c.accountInfo;
          if (accountInfo) accountSet.add(accountInfo);
          if (c.accountInfo) accountSet.add(c.accountInfo);

          data.push({
            client_id: c.id,
            client_name: c.name,
            project_name: c.projectName,
            agreed_amount: c.agreedAmount,
            currency: c.currency,
            payment_day: c.paymentDay,
            account_info: accountInfo,
            payment_id: p.id,
            amount: c.agreedAmount,
            paid_amount: p.amount,
            status: p.status,
            paid_date: p.paidDate ?? null,
            period_notes: p.periodNotes ?? null,
            due_date: p.dueDate,
            period: p.period,
            source: c.source,
            grace_period_days: c.gracePeriodDays,
          });
          addedKeys.add(`${c.id}:${p.period}`);
        }
      }

      // Now add missing (virtual) payments whose COMPUTED due date falls in the range
      for (const period of periodsToCheck) {
        for (const c of activeClients) {
          if (c.status === 'pasif') continue;
          if (!clientActiveInPeriod(c.startDate, period)) continue;
          if (clientEndedBeforePeriod(c.endDate, period)) continue;

          const key = `${c.id}:${period}`;
          if (addedKeys.has(key)) continue; // already added from DB

          const payment = paymentIndex.get(key);
          const dueDate = payment ? payment.dueDate : computeDueDate(period, c.paymentDay, c.paymentType);
          
          if (dueDate >= targetStartDate && dueDate <= targetEndDate) {
            const accountInfo = payment?.accountInfo || c.accountInfo;
            if (accountInfo) accountSet.add(accountInfo);
            if (c.accountInfo) accountSet.add(c.accountInfo);

            data.push({
              client_id: c.id,
              client_name: c.name,
              project_name: c.projectName,
              agreed_amount: c.agreedAmount,
              currency: c.currency,
              payment_day: c.paymentDay,
              account_info: accountInfo,
              payment_id: payment?.id ?? null,
              amount: c.agreedAmount,
              paid_amount: payment ? payment.amount : null,
              status: payment?.status ?? 'pending',
              paid_date: payment?.paidDate ?? null,
              period_notes: payment?.periodNotes ?? null,
              due_date: dueDate,
              period,
              source: c.source,
              grace_period_days: c.gracePeriodDays,
            });
            addedKeys.add(key);
          }
        }
      }

      // Sort: overdue (pending & past due_date) first by oldest due_date, then rest
      data.sort((a, b) => {
        const aOverdue = (a.status === 'pending' && (a.due_date as string) < today) ? 0 : 1;
        const bOverdue = (b.status === 'pending' && (b.due_date as string) < today) ? 0 : 1;
        if (aOverdue !== bOverdue) return aOverdue - bOverdue;
        return ((a.due_date as string) < (b.due_date as string)) ? -1 : 1;
      });

      // ------- monthly_stats (last 12 months) --------------------------------
      const now = new Date();
      const statsMonths: string[] = [];
      {
        let sy = now.getFullYear();
        let sm = now.getMonth() + 1;
        // Go back 11 months to get 12 months total
        for (let i = 0; i < 11; i++) {
          sm--;
          if (sm < 1) { sm = 12; sy--; }
        }
        for (let i = 0; i < 12; i++) {
          statsMonths.push(`${sy}-${String(sm).padStart(2, '0')}`);
          sm++;
          if (sm > 12) { sm = 1; sy++; }
        }
      }

      // Fetch payments for stats period
      const statsPayments = await db
        .select()
        .from(payments)
        .where(inArray(payments.period, statsMonths));

      const statsPaymentIndex = new Map<string, typeof statsPayments[number][]>();
      for (const p of statsPayments) {
        const key = p.period;
        if (!statsPaymentIndex.has(key)) statsPaymentIndex.set(key, []);
        statsPaymentIndex.get(key)!.push(p);
      }

      const monthlyStats = statsMonths.map((month) => {
        const monthPayments = statsPaymentIndex.get(month) || [];

        // Expected: sum of agreed_amount for all active clients in that month
        let expected = 0;
        for (const c of activeClients) {
          if (clientActiveInPeriod(c.startDate, month) && !clientEndedBeforePeriod(c.endDate, month) && c.status !== 'pasif') {
            expected += c.agreedAmount;
          }
        }

        // Paid: sum of payment amounts where status = 'paid' or 'partial'
        let paid = 0;
        for (const p of monthPayments) {
          if (p.status === 'paid' || p.status === 'partial') {
            paid += p.amount;
          }
        }

        return { label: turkishLabel(month), expected, paid };
      });

      // ------- account_stats --------------------------------------------------
      const accountStatsMap = new Map<string, { paid_amount: number; total_amount: number }>();
      for (const row of data) {
        const acc = row.account_info as string;
        if (!acc) continue;
        if (!accountStatsMap.has(acc)) accountStatsMap.set(acc, { paid_amount: 0, total_amount: 0 });
        const entry = accountStatsMap.get(acc)!;
        entry.total_amount += (row.agreed_amount as number) || 0;
        if (row.status === 'paid' || row.status === 'partial') {
          entry.paid_amount += (row.paid_amount as number) || 0;
        }
      }
      const accountStats = Array.from(accountStatsMap.entries()).map(([account, s]) => ({
        account,
        ...s,
      }));

      // ------- delay_stats ----------------------------------------------------
      const allPaidPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.status, 'paid'));

      const clientDelayMap = new Map<number, { totalDelay: number; count: number; name: string; project: string }>();
      for (const p of allPaidPayments) {
        if (!p.paidDate || !p.dueDate) continue;
        const delay = daysDiff(p.paidDate, p.dueDate);
        if (!clientDelayMap.has(p.clientId)) {
          // Look up client name
          const c = activeClients.find((cl) => cl.id === p.clientId);
          clientDelayMap.set(p.clientId, {
            totalDelay: 0,
            count: 0,
            name: c?.name ?? '',
            project: c?.projectName ?? '',
          });
        }
        const entry = clientDelayMap.get(p.clientId)!;
        entry.totalDelay += delay;
        entry.count++;
      }
      const delayStats = Array.from(clientDelayMap.values())
        .filter((e) => e.count > 0)
        .map((e) => ({
          client_name: e.name,
          project_name: e.project,
          avg_delay_days: Math.round((e.totalDelay / e.count) * 100) / 100,
        }));

      // ------- report_metrics -------------------------------------------------
      const currentYear = now.getFullYear();
      const paidPerMonth = new Map<string, number>();
      for (const p of statsPayments) {
        if (p.status === 'paid' || p.status === 'partial') {
          paidPerMonth.set(p.period, (paidPerMonth.get(p.period) || 0) + p.amount);
        }
      }

      const monthlyPaidValues = Array.from(paidPerMonth.values());
      const avgMonthly = monthlyPaidValues.length > 0
        ? monthlyPaidValues.reduce((a, b) => a + b, 0) / monthlyPaidValues.length
        : 0;

      // Last 3 months
      const last3Months = statsMonths.slice(-3);
      const last3Values = last3Months.map((m) => paidPerMonth.get(m) || 0);
      const avg3m = last3Values.length > 0
        ? last3Values.reduce((a, b) => a + b, 0) / last3Values.length
        : 0;

      // Yearly total
      let yearlyTotal = 0;
      for (const [period, amount] of paidPerMonth) {
        if (period.startsWith(String(currentYear))) {
          yearlyTotal += amount;
        }
      }

      const reportMetrics = {
        avg_monthly: Math.round(avgMonthly * 100) / 100,
        avg_3m: Math.round(avg3m * 100) / 100,
        yearly_total: Math.round(yearlyTotal * 100) / 100,
      };

      // ------- client_earnings ------------------------------------------------
      const clientEarningsMap = new Map<number, {
        client_name: string;
        project_name: string;
        total_expected: number;
        total_paid: number;
        currency: string;
      }>();

      for (const row of data) {
        const cid = row.client_id as number;
        if (!clientEarningsMap.has(cid)) {
          clientEarningsMap.set(cid, {
            client_name: row.client_name as string,
            project_name: row.project_name as string,
            total_expected: 0,
            total_paid: 0,
            currency: row.currency as string,
          });
        }
        const entry = clientEarningsMap.get(cid)!;
        entry.total_expected += (row.agreed_amount as number) || 0;
        if (row.status === 'paid' || row.status === 'partial') {
          entry.total_paid += (row.paid_amount as number) || 0;
        }
      }
      const clientEarnings = Array.from(clientEarningsMap.values());

      return ok({
        data,
        account_options: Array.from(accountSet),
        monthly_stats: monthlyStats,
        account_stats: accountStats,
        delay_stats: delayStats,
        report_metrics: reportMetrics,
        client_earnings: clientEarnings,
      });
    }

    // -----------------------------------------------------------------------
    // settings_get
    // -----------------------------------------------------------------------
    if (api === 'settings_get') {
      const rows = await db.select().from(settings);
      const result: Record<string, string | null> = {};
      for (const row of rows) {
        result[row.key] = row.value;
      }
      return ok({
        data: {
          smtp_host: result.smtp_host ?? '',
          smtp_port: result.smtp_port ?? '',
          smtp_secure: result.smtp_secure ?? '',
          notification_email: result.notification_email ?? '',
          smtp_user: result.smtp_user ?? '',
          smtp_pass: result.smtp_pass ?? '',
          gemini_api_key: result.gemini_api_key ?? '',
        },
      });
    }

    return fail('Unknown API endpoint');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Legacy API GET Error:', error);
    return fail(message, 500);
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const url = req.nextUrl;
  const api = url.searchParams.get('api');

  try {
    const body = await req.json();

    // -----------------------------------------------------------------------
    // client_create
    // -----------------------------------------------------------------------
    if (api === 'client_create') {
      const result = await db
        .insert(clients)
        .values({
          name: body.name,
          projectName: body.project_name,
          agreedAmount: parseFloat(body.agreed_amount) || 0,
          currency: body.currency || 'TRY',
          paymentDay: parseInt(body.payment_day, 10) || 1,
          paymentType: body.payment_type || 'upfront',
          accountInfo: body.account_info || '',
          status: body.status || 'aktif',
          agreementDate: body.agreement_date || body.start_date || new Date().toISOString().split('T')[0],
          startDate: body.start_date || new Date().toISOString().split('T')[0],
          notes: body.notes || null,
          source: body.source || 'Meta',
          gracePeriodDays: parseInt(body.grace_period_days, 10) || 5,
        })
        .returning();

      return ok({ client_id: result[0].id });
    }

    // -----------------------------------------------------------------------
    // client_update
    // -----------------------------------------------------------------------
    if (api === 'client_update') {
      const clientId = parseInt(body.id, 10);
      if (!clientId) return fail('Missing client id');

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.project_name !== undefined) updateData.projectName = body.project_name;
      if (body.agreed_amount !== undefined) updateData.agreedAmount = parseFloat(body.agreed_amount) || 0;
      if (body.currency !== undefined) updateData.currency = body.currency;
      if (body.payment_day !== undefined) updateData.paymentDay = parseInt(body.payment_day, 10) || 1;
      if (body.payment_type !== undefined) updateData.paymentType = body.payment_type;
      if (body.account_info !== undefined) updateData.accountInfo = body.account_info;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.agreement_date !== undefined) updateData.agreementDate = body.agreement_date;
      if (body.start_date !== undefined) updateData.startDate = body.start_date;
      if (body.notes !== undefined) updateData.notes = body.notes;
      if (body.source !== undefined) updateData.source = body.source;
      if (body.grace_period_days !== undefined) updateData.gracePeriodDays = parseInt(body.grace_period_days, 10) || 5;
      if (body.end_date !== undefined) updateData.endDate = body.end_date;

      await db.update(clients).set(updateData).where(eq(clients.id, clientId));
      return ok({ message: 'Client updated' });
    }

    // -----------------------------------------------------------------------
    // client_delete
    // -----------------------------------------------------------------------
    if (api === 'client_delete') {
      const clientId = parseInt(body.id, 10);
      if (!clientId) return fail('Missing client id');

      await db.delete(clients).where(eq(clients.id, clientId));
      return ok({ message: 'Client deleted' });
    }

    // -----------------------------------------------------------------------
    // save_inline
    // -----------------------------------------------------------------------
    if (api === 'save_inline') {
      const clientId = parseInt(body.client_id, 10);
      const period: string = body.period;
      const field: string = body.field;
      const value = body.value;

      if (!clientId || !period || !field) {
        return fail('Missing required fields: client_id, period, field');
      }

      // Look up existing payment
      const existing = await db
        .select()
        .from(payments)
        .where(and(eq(payments.clientId, clientId), eq(payments.period, period)));

      // Look up the client (needed for defaults when creating a new payment)
      const [client] = await db.select().from(clients).where(eq(clients.id, clientId));

      let paymentId = 0;

      if (existing.length === 0) {
        // Create a new payment record with correct defaults
        const dueDate = client
          ? computeDueDate(period, client.paymentDay, client.paymentType)
          : `${period}-01`;

        const newPayment = await db
          .insert(payments)
          .values({
            clientId,
            period,
            amount: 0,
            currency: client?.currency || 'TRY',
            status: 'pending',
            dueDate,
            accountInfo: client?.accountInfo || null,
          })
          .returning();

        paymentId = newPayment[0].id;
      } else {
        paymentId = existing[0].id;
      }

      // Build update object
      const updates: Record<string, unknown> = {};

      switch (field) {
        case 'amount':
        case 'paid_amount': {
          const paidAmount = parseFloat(value) || 0;
          updates.amount = paidAmount;
          // Auto-detect status
          if (paidAmount <= 0) {
            updates.status = 'pending';
          } else if (client && paidAmount < client.agreedAmount) {
            updates.status = 'partial';
          } else {
            updates.status = 'paid';
          }
          break;
        }
        case 'paid_date':
          updates.paidDate = value || null;
          break;
        case 'due_date':
          updates.dueDate = value || null;
          break;
        case 'period_notes':
          updates.periodNotes = value ?? null;
          break;
        case 'account_info':
          updates.accountInfo = value || null;
          break;
        case 'status_with_date': {
          try {
            const parsed = JSON.parse(value);
            if (parsed.status) {
              updates.status = parsed.status;
              // If marking as paid, and it was previously pending (amount=0), auto-fill the full agreed amount
              if (parsed.status === 'paid') {
                 const currentAmount = existing.length > 0 ? existing[0].amount : 0;
                 if (currentAmount <= 0 && client) {
                    updates.amount = client.agreedAmount;
                 }
              }
            }
            if (parsed.paid_date !== undefined) updates.paidDate = parsed.paid_date;
          } catch {
            return fail('Invalid JSON for status_with_date');
          }
          break;
        }
        default:
          return fail(`Unsupported field: ${field}`);
      }

      if (Object.keys(updates).length > 0) {
        await db.update(payments).set(updates).where(eq(payments.id, paymentId));
      }

      return ok({ message: 'Payment updated' });
    }

    // -----------------------------------------------------------------------
    // settings_save
    // -----------------------------------------------------------------------
    if (api === 'settings_save') {
      const keys = [
        'smtp_host',
        'smtp_port',
        'smtp_secure',
        'notification_email',
        'smtp_user',
        'smtp_pass',
        'gemini_api_key',
      ];

      for (const key of keys) {
        if (body[key] !== undefined) {
          await db
            .insert(settings)
            .values({ key, value: String(body[key]) })
            .onConflictDoUpdate({
              target: settings.key,
              set: { value: String(body[key]) },
            });
        }
      }

      return ok({ message: 'Settings saved' });
    }

    // -----------------------------------------------------------------------
    // carry_over
    // -----------------------------------------------------------------------
    if (api === 'carry_over') {
      const clientId = parseInt(body.client_id, 10);
      const period: string = body.period;

      if (!clientId || !period) {
        return fail('Missing required fields: client_id, period');
      }

      // Fetch client
      const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
      if (!client) return fail('Client not found', 404);

      // Fetch current period's payment
      const [currentPayment] = await db
        .select()
        .from(payments)
        .where(and(eq(payments.clientId, clientId), eq(payments.period, period)));

      const agreedAmount = client.agreedAmount;
      const paidAmount = currentPayment?.amount ?? 0;
      const remaining = agreedAmount - paidAmount;

      // Calculate next period
      const [py, pm] = period.split('-').map(Number);
      let nextMonth = pm + 1;
      let nextYear = py;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear++;
      }
      const toPeriod = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
      const nextDueDate = computeDueDate(toPeriod, client.paymentDay, client.paymentType);

      // Update current period payment status if partially paid
      if (currentPayment) {
        if (paidAmount > 0 && paidAmount < agreedAmount) {
          await db
            .update(payments)
            .set({ status: 'partial' })
            .where(eq(payments.id, currentPayment.id));
        }
      }

      // Check if next period payment already exists
      const [existingNext] = await db
        .select()
        .from(payments)
        .where(and(eq(payments.clientId, clientId), eq(payments.period, toPeriod)));

      if (existingNext) {
        // Add remaining to existing next period payment
        await db
          .update(payments)
          .set({ amount: existingNext.amount + remaining })
          .where(eq(payments.id, existingNext.id));
      } else {
        // Create a new payment record for next period with remaining amount
        await db.insert(payments).values({
          clientId,
          period: toPeriod,
          amount: remaining,
          currency: client.currency,
          status: 'pending',
          dueDate: nextDueDate,
          accountInfo: client.accountInfo,
        });
      }

      return ok({ to_period: toPeriod, carried_over: remaining });
    }

    return fail('Unknown API endpoint');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Legacy API POST Error:', error);
    return fail(message, 500);
  }
}
