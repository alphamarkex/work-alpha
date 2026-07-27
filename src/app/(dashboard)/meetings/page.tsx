import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleUserIds } from '@/lib/permissions';
import MeetingForm from '@/components/meeting-form';
import clsx from 'clsx';

export default async function MeetingsPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const visibleIds = await getVisibleUserIds(user.id, user.role);
  // Meetings are visible company-wide — anyone in the organization can see
  // any meeting (and its join link), not just their own reporting chain.
  const where = { host: { organizationId: user.organizationId } };
  const clientWhere = {
    organizationId: user.organizationId,
    ...(visibleIds ? { ownerId: { in: visibleIds } } : {}),
  };

  const [meetings, clients] = await Promise.all([
    prisma.meeting.findMany({
      where,
      include: {
        client: { select: { name: true } },
        host: { select: { name: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    }),
    prisma.client.findMany({
      where: clientWhere,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Meetings</h1>
        <p className="text-sm text-gray-500">Scheduled calls and client meetings.</p>
      </div>

      <MeetingForm clients={clients} />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Host</th>
              <th className="px-4 py-3">Link</th>
              <th className="px-4 py-3">Reminder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {meetings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No meetings scheduled.
                </td>
              </tr>
            )}
            {meetings.map((meeting) => {
              const isPast = meeting.scheduledAt < now;
              return (
                <tr key={meeting.id} className={clsx(isPast && 'opacity-60')}>
                  <td className="px-4 py-3 font-medium text-gray-900">{meeting.title}</td>
                  <td className="px-4 py-3 text-gray-500">{meeting.client?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {meeting.scheduledAt.toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{meeting.host.name}</td>
                  <td className="px-4 py-3">
                    {meeting.meetingLink ? (
                      <a
                        href={meeting.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-brand-600 hover:text-brand-700"
                      >
                        Join
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {meeting.reminderSentAt ? 'Sent' : isPast ? '—' : 'Pending'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
