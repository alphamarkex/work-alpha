import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageHolidays } from '@/lib/permissions';

const createHolidaySchema = z.object({
  name: z.string().min(1),
  date: z.string(), // ISO date string
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const holidays = await prisma.holidayEntry.findMany({
    where: { createdBy: { organizationId: session.user.organizationId } },
    orderBy: { date: 'asc' },
  });

  return NextResponse.json({ holidays });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canManageHolidays(session.user.role)) {
    return NextResponse.json({ error: 'Only Founders/Managers can add holidays' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createHolidaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const holiday = await prisma.holidayEntry.create({
    data: {
      name: parsed.data.name,
      date: new Date(parsed.data.date),
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ holiday }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canManageHolidays(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing holiday id' }, { status: 400 });
  }

  const holiday = await prisma.holidayEntry.findUnique({
    where: { id },
    include: { createdBy: true },
  });
  if (!holiday || holiday.createdBy.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Holiday not found' }, { status: 404 });
  }

  await prisma.holidayEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
