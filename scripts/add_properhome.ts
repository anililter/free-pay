import { db } from '../src/db';
import { clients, payments } from '../src/db/schema';
import { ilike, eq } from 'drizzle-orm';

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function computeDueDate(period: string, paymentDay: number, paymentType: string = 'upfront'): string {
  let [y, m] = period.split('-').map(Number);
  if (paymentType === 'net30' || paymentType === 'postpaid') {
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

async function main() {
  const properhome = await db.select().from(clients).where(ilike(clients.name, '%Properhome%')).limit(1);
  if (properhome.length === 0) {
    console.error('Properhome not found');
    return;
  }

  const client = properhome[0];
  console.log(`Found client: ${client.name} (ID: ${client.id})`);
  
  // They want to add payments from 2025-01 to 2026-06 (current month)
  const startYear = 2025;
  const startMonth = 1;
  const endYear = 2026;
  const endMonth = 6;
  
  const periods = [];
  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    periods.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  for (const period of periods) {
    // Check if payment already exists
    const existing = await db.select().from(payments).where(
      eq(payments.clientId, client.id)
    ).execute();
    
    const exists = existing.find(p => p.period === period);
    
    if (exists) {
        if (exists.status !== 'paid') {
            await db.update(payments).set({
                status: 'paid',
                amount: client.agreedAmount,
                paidDate: exists.dueDate || computeDueDate(period, client.paymentDay, client.paymentType)
            }).where(eq(payments.id, exists.id));
            console.log(`Updated period ${period} to paid.`);
        } else {
            console.log(`Period ${period} already paid.`);
        }
    } else {
        const dueDate = computeDueDate(period, client.paymentDay, client.paymentType);
        await db.insert(payments).values({
            clientId: client.id,
            period: period,
            amount: client.agreedAmount,
            status: 'paid',
            dueDate: dueDate,
            paidDate: dueDate,
            accountInfo: client.accountInfo || 'IBAN',
            createdAt: new Date().toISOString()
        });
        console.log(`Inserted period ${period} as paid.`);
    }
  }
}

main().catch(console.error);
