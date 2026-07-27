import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageHolidays } from '@/lib/permissions';
import HolidayForm from '@/components/holiday-form';
import HolidayRowActions from '@/components/holiday-row-actions';

export default async function HolidaysPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;
  const canManage = canManageHolidays(user.role);

  const holidays = await prisma.holidayEntry.findMany({
    where: { createdBy: { organizationId: user.organizationId } },
    orderBy: { date: 'asc' },
  });

  const now = new Date();
  const upcoming = holidays.filter((h) => h.date >= now);
  const past = holidays.filter((h) => h.date < now);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Holidays</h1>
        <p className="text-sm text-gray-500">Company-wide holidays — no need to clock in on these days.</p>
      </div>

      {canManage && <HolidayForm />}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Upcoming</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <tbody className="divide-y divide-gray-100">
            {upcoming.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500">No upcoming holidays.</td>
              </tr>
            )}
            {upcoming.map((holiday) => (
              <tr key={holiday.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{holiday.name}</td>
                <td className="px-4 py-3 text-gray-500">
                  {holiday.date.toLocaleDateString('en-IN', { dateStyle: 'full', timeZone: 'Asia/Kolkata' })}
                </td>
                <td className="px-4 py-3 text-right">
                  {canManage && <HolidayRowActions holidayId={holiday.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {past.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Past</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <tbody className="divide-y divide-gray-100">
              {past.map((holiday) => (
                <tr key={holiday.id}>
                  <td className="px-4 py-3 text-gray-500">{holiday.name}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {holiday.date.toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
