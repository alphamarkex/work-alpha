import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleUserIds } from '@/lib/permissions';
import { startOfDay, getShiftWindow, computeMissingIntervals, sumMinutes } from '@/lib/attendance';
import clsx from 'clsx';

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const session = await getServerSession(authOptions);
  const user = session!.user;

  if (user.role === 'EMPLOYEE') {
    redirect('/dashboard');
  }

  const date = searchParams.date ? new Date(searchParams.date) : new Date();
  const day = startOfDay(date);
  const { start: shiftStart, end: shiftEnd } = getShiftWindow(day);
  const now = new Date();

  const visibleIds = await getVisibleUserIds(user.id, user.role);
  const userWhere = visibleIds
    ? { id: { in: visibleIds }, role: { in: ['MANAGER', 'EMPLOYEE'] as Array<'MANAGER' | 'EMPLOYEE'> } }
    : { role: { in: ['MANAGER', 'EMPLOYEE'] as Array<'MANAGER' | 'EMPLOYEE'> } };

  const teamMembers = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true, employeeId: true },
    orderBy: { name: 'asc' },
  });

  const rows = await Promise.all(
    teamMembers.map(async (member) => {
      const attendanceDay = await prisma.attendanceDay.findUnique({
        where: { userId_date: { userId: member.id, date: day } },
      });

      if (!attendanceDay?.clockInAt) {
        return {
          member,
          clockInAt: null as Date | null,
          clockOutAt: null as Date | null,
          status: shiftEnd < now ? 'ABSENT' : null,
          breakMinutesUsed: 0,
          missingMinutes: 0,
        };
      }

      const pings = await prisma.activityPing.findMany({
        where: { userId: member.id, timestamp: { gte: shiftStart, lte: shiftEnd } },
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
        member,
        clockInAt: attendanceDay.clockInAt,
        clockOutAt: attendanceDay.clockOutAt,
        status: attendanceDay.status,
        breakMinutesUsed: Math.round(attendanceDay.totalBreakSeconds / 60),
        missingMinutes: sumMinutes(missingIntervals),
      };
    })
  );

  const dateStr = day.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Attendance</h1>
        <p className="text-sm text-gray-500">
          Shift 10:00 AM – 4:00 PM · 1-hour break cap · idle stretches over 5 minutes are flagged.
        </p>
      </div>

      <form className="flex items-center gap-2">
        <input
          type="date"
          name="date"
          defaultValue={dateStr}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          View
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Clock in</th>
              <th className="px-4 py-3">Clock out</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Break used</th>
              <th className="px-4 py-3">Missing activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No team members to show.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.member.id}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {row.member.name}{' '}
                  <span className="text-xs text-gray-400">({row.member.employeeId})</span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {row.clockInAt
                    ? row.clockInAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {row.clockOutAt
                    ? row.clockOutAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  {row.status ? (
                    <span
                      className={clsx(
                        'rounded-full px-2 py-1 text-xs font-medium',
                        row.status === 'LATE' && 'bg-yellow-100 text-yellow-800',
                        row.status === 'ABSENT' && 'bg-red-100 text-red-800',
                        row.status === 'ON_TIME' && 'bg-green-100 text-green-800'
                      )}
                    >
                      {row.status.replace('_', ' ')}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{row.breakMinutesUsed}m</td>
                <td className="px-4 py-3">
                  {row.missingMinutes > 0 ? (
                    <span className="font-medium text-red-600">{row.missingMinutes}m</span>
                  ) : (
                    <span className="text-gray-400">0m</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
