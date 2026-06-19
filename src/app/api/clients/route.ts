import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clients, payments } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  try {
    const allClients = await db.select().from(clients).orderBy(desc(clients.id));
    return NextResponse.json(allClients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newClient = await db.insert(clients).values({
      name: body.name,
      projectName: body.projectName,
      agreedAmount: parseFloat(body.agreedAmount),
      currency: body.currency || 'TRY',
      paymentDay: parseInt(body.paymentDay),
      paymentType: body.paymentType || 'upfront',
      accountInfo: body.accountInfo,
      status: body.status || 'aktif',
      agreementDate: body.agreementDate,
      startDate: body.startDate,
      notes: body.notes,
      source: body.source || 'Meta',
      referredById: body.referredById ? parseInt(body.referredById) : null,
    }).returning();

    return NextResponse.json(newClient[0]);
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}
