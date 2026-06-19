import { NextResponse } from 'next/server';
import { db } from '@/db';
import { payments } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const resolvedParams = await params;
    const paymentId = parseInt(resolvedParams.id);

    const updatedPayment = await db.update(payments).set({
      status: body.status,
      paidDate: body.paidDate,
      periodNotes: body.periodNotes,
      accountInfo: body.accountInfo,
    }).where(eq(payments.id, paymentId)).returning();

    return NextResponse.json(updatedPayment[0]);
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const paymentId = parseInt(resolvedParams.id);
    await db.delete(payments).where(eq(payments.id, paymentId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
