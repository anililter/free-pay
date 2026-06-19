import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clients } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();
    const resolvedParams = await params;
    const clientId = parseInt(resolvedParams.id);

    const updatedClient = await db.update(clients).set({
      name: body.name,
      projectName: body.projectName,
      agreedAmount: body.agreedAmount ? parseFloat(body.agreedAmount) : undefined,
      currency: body.currency,
      paymentDay: body.paymentDay ? parseInt(body.paymentDay) : undefined,
      paymentType: body.paymentType,
      accountInfo: body.accountInfo,
      status: body.status,
      agreementDate: body.agreementDate,
      startDate: body.startDate,
      notes: body.notes,
      source: body.source,
      referredById: body.referredById ? parseInt(body.referredById) : null,
    }).where(eq(clients.id, clientId)).returning();

    return NextResponse.json(updatedClient[0]);
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const clientId = parseInt(resolvedParams.id);
    await db.delete(clients).where(eq(clients.id, clientId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
