import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleUserIds } from '@/lib/permissions';

const createMeetingSchema = z.object({
  title: z.string().min(1),
  clientId: z.string().optional().nullable(),
  scheduledAt: z.string(), // ISO datetime string
  notes: z.string().optional().nullable(),
  meetingLink: z.string().url().optional().nullable().or(z.literal('')),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const visibleIds = await getVisibleUserIds(session.user.id, session.user.role);
  const where = visibleIds ? { hostId: { in: visibleIds } } : {};

  const { searchParams } = new URL(req.url);
  const upcoming = searchParams.get('upcoming');

  const meetings = await prisma.meeting.findMany({
    where: {
      ...where,
      ...(upcoming === 'true' ? { scheduledAt: { gte: new Date() } } : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
      host: { select: { id: true, name: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  return NextResponse.json({ meetings });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createMeetingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  if (data.clientId) {
    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const visibleIds = await getVisibleUserIds(session.user.id, session.user.role);
    if (visibleIds && !visibleIds.includes(client.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const meeting = await prisma.meeting.create({
    data: {
      title: data.title,
      clientId: data.clientId ?? null,
      hostId: session.user.id,
      scheduledAt: new Date(data.scheduledAt),
      notes: data.notes ?? null,
      meetingLink: data.meetingLink || null,
    },
    include: {
      client: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ meeting }, { status: 201 });
}
