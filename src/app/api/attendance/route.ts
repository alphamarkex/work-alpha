import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  startOfDay,
  getShiftWindow,
  isLateClockIn,
  computeMissingIntervals,
  sumMinutes,
  MAX_BREAK_MINUTES,
} from '@/lib/attendance';

const actionSchema = z.object({
  action: z.enum(['clock-in', 'clock-out', 'break-start', 'break-end', 'ping']),
});

async function getOrCreateToday(userId: string) {
  const today = startOfDay(new Date());
  const existing = await prisma.attendanceDay.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  if (existing) return existing;
  return prisma.attendanceDay.create({ data: { userId, date: today } });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const day = await getOrCreateToday(session.user.id);
  const now = new Date();
  const { start: shiftStart, end: shiftEnd } = getShiftWindow(now);

  const pings = await prisma.activityPing.findMany({
    where: { userId: session.user.id, timestamp: { gte: shiftStart, lte: shiftEnd } },
    select: { timestamp: true },
    orderBy: { timestamp: 'asc' },
  });

  const windowStart = day.clockInAt ?? shiftStart;
  const windowEnd = day.clockOutAt ?? (now < shiftEnd ? now : shiftEnd);

  const missingIntervals = day.clockInAt
    ? computeMissingIntervals({
        pings: pings.map((p) => p.timestamp),
        windowStart,
        windowEnd,
        breakStart: day.breakStartAt,
        breakEnd: day.breakEndAt,
      })
    : [];

  return NextResponse.json({
    day,
    onBreak: Boolean(day.breakStartAt && !day.breakEndAt),
    breakMinutesUsed: Math.round(day.totalBreakSeconds / 60),
    breakMinutesRemaining: Math.max(0, MAX_BREAK_MINUTES - Math.round(day.totalBreakSeconds / 60)),
    missingIntervals,
    missingMinutesToday: sumMinutes(missingIntervals),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { action } = parsed.data;
  const now = new Date();

  if (action === 'ping') {
    await prisma.activityPing.create({ data: { userId: session.user.id, timestamp: now } });
    return NextResponse.json({ success: true });
  }

  const day = await getOrCreateToday(session.user.id);

  switch (action) {
    case 'clock-in': {
      if (day.clockInAt) {
        return NextResponse.json({ error: 'Already clocked in for today' }, { status: 400 });
      }
      const updated = await prisma.attendanceDay.update({
        where: { id: day.id },
        data: { clockInAt: now, status: isLateClockIn(now) ? 'LATE' : 'ON_TIME' },
      });
      return NextResponse.json({ day: updated });
    }

    case 'clock-out': {
      if (!day.clockInAt) {
        return NextResponse.json({ error: "You haven't clocked in yet" }, { status: 400 });
      }
      if (day.clockOutAt) {
        return NextResponse.json({ error: 'Already clocked out for today' }, { status: 400 });
      }
      if (day.breakStartAt && !day.breakEndAt) {
        return NextResponse.json({ error: 'End your break before clocking out' }, { status: 400 });
      }
      const updated = await prisma.attendanceDay.update({
        where: { id: day.id },
        data: { clockOutAt: now },
      });
      return NextResponse.json({ day: updated });
    }

    case 'break-start': {
      if (!day.clockInAt) {
        return NextResponse.json({ error: 'Clock in before taking a break' }, { status: 400 });
      }
      if (day.breakStartAt && !day.breakEndAt) {
        return NextResponse.json({ error: 'Break already in progress' }, { status: 400 });
      }
      if (Math.round(day.totalBreakSeconds / 60) >= MAX_BREAK_MINUTES) {
        return NextResponse.json({ error: "You've used your full 1-hour break for today" }, { status: 400 });
      }
      const updated = await prisma.attendanceDay.update({
        where: { id: day.id },
        data: { breakStartAt: now, breakEndAt: null },
      });
      return NextResponse.json({ day: updated });
    }

    case 'break-end': {
      if (!day.breakStartAt || day.breakEndAt) {
        return NextResponse.json({ error: 'No break in progress' }, { status: 400 });
      }
      const elapsedSeconds = Math.round((now.getTime() - day.breakStartAt.getTime()) / 1000);
      const updated = await prisma.attendanceDay.update({
        where: { id: day.id },
        data: {
          breakEndAt: now,
          totalBreakSeconds: day.totalBreakSeconds + elapsedSeconds,
        },
      });
      return NextResponse.json({ day: updated });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
