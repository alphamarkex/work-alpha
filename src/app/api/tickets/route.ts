import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canHandleTickets, getVisibleUserIds } from '@/lib/permissions';

const createTicketSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

const updateTicketSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  response: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const visibleIds = await getVisibleUserIds(session.user.id, session.user.role);
  const where = visibleIds ? { raisedById: { in: visibleIds } } : {};

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      raisedBy: { select: { id: true, name: true } },
      handledBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ tickets });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const ticket = await prisma.ticket.create({
    data: {
      title: data.title,
      description: data.description,
      raisedById: session.user.id,
    },
    include: {
      raisedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ ticket }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canHandleTickets(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const ticket = await prisma.ticket.findUnique({ where: { id: data.id } });
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const visibleIds = await getVisibleUserIds(session.user.id, session.user.role);
  if (visibleIds && !visibleIds.includes(ticket.raisedById)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await prisma.ticket.update({
    where: { id: data.id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
      ...(data.response !== undefined ? { response: data.response } : {}),
      handledById: session.user.id,
    },
    include: {
      raisedBy: { select: { id: true, name: true } },
      handledBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ ticket: updated });
}
