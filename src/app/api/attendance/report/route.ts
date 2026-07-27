import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleUserIds } from '@/lib/permissions';
import { startOfDay, getShiftWindow, computeMissingIntervals, sumMinutes } from '@/lib/attendance';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Employees only see their own attendance via /api/attendance; this report
  // is for Founders (everyone) and Managers (their own reports).
  if (session.user.role === 'EMPLOYEE') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get('date');
  const date = dateParam ? new Date(dateParam) : new Date();
  const day = startOfDay(date);
  const { start: shiftStart, end: shiftEnd } = getShiftWindow(day);
  const now = new Date();

  const visibleIds = await getVisibleUserIds(session.user.id, session.user.role);
  const userWhere = visibleIds
    ? {
        id: { in: visibleIds },
        organizationId: session.user.organizationId,
        role: { in: ['MANAGER', 'EMPLOYEE'] as Array<'MANAGER' | 'EMPLOYEE'> },
      }
    : {
        organizationId: session.user.organizationId,
        role: { in: ['MANAGER', 'EMPLOYEE'] as Array<'MANAGER' | 'EMPLOYEE'> },
      };

  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true, employeeId: true },
    orderBy: { name: 'asc' },
  });

  const rows = await Promise.all(
    users.map(async (user) => {
      const attendanceDay = await prisma.attendanceDay.findUnique({
        where: { userId_date: { userId: user.id, date: day } },
      });

      if (!attendanceDay?.clockInAt) {
        return {
          user,
          clockInAt: null,
          clockOutAt: null,
          status: shiftEnd < now ? 'ABSENT' : null,
          breakMinutesUsed: 0,
          missingMinutes: 0,
        };
      }

      const pings = await prisma.activityPing.findMany({
        where: { userId: user.id, timestamp: { gte: shiftStart, lte: shiftEnd } },
        select: { timestamp: true },
      });

      const windowEnd = attendanceDay.clockOutAt ?? (now < shiftEnd ? now : shiftEnd);
      const missingIntervals = computeMissingIntervals({
        pings: pings.map((p) => p.timestamp),
        windowStart: attendanceDay.clockInAt,
        windowEnd,
        breakStart: attendanceDay.breakStartAt,
        breakEnd: attendanceDay.breakEndAt,
      });

      return {
        user,
        clockInAt: attendanceDay.clockInAt,
        clockOutAt: attendanceDay.clockOutAt,
        status: attendanceDay.status,
        breakMinutesUsed: Math.round(attendanceDay.totalBreakSeconds / 60),
        missingMinutes: sumMinutes(missingIntervals),
      };
    })
  );

  return NextResponse.json({ date: day, rows });
}
