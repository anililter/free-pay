import { NextResponse } from 'next/server';
import { db } from '@/db';
import { payments } from '@/db/schema';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newPayment = await db.insert(payments).values({
      clientId: parseInt(body.clientId),
      period: body.period,
      amount: parseFloat(body.amount),
      currency: body.currency || 'TRY',
      status: body.status || 'pending',
      paidDate: body.paidDate,
      periodNotes: body.periodNotes,
      dueDate: body.dueDate,
      accountInfo: body.accountInfo,
    }).returning();

    return NextResponse.json(newPayment[0]);
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
