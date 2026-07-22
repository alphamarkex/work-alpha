import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canHandleTickets, getVisibleUserIds } from '@/lib/permissions';
import TicketForm from '@/components/ticket-form';
import TicketResponseForm from '@/components/ticket-response-form';
import clsx from 'clsx';

const statusStyles: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-600',
};

export default async function TicketsPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;
  const canHandle = canHandleTickets(user.role);

  const visibleIds = await getVisibleUserIds(user.id, user.role);
  const where = visibleIds ? { raisedById: { in: visibleIds } } : {};

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      raisedBy: { select: { id: true, name: true } },
      handledBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Tickets</h1>
        <p className="text-sm text-gray-500">
          Raise an issue, question, or error to your team — and track the response.
        </p>
      </div>

      <TicketForm />

      {tickets.length === 0 && (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
          No tickets yet.
        </p>
      )}

      <div className="space-y-4">
        {tickets.map((ticket) => {
          const canRespond = canHandle && (visibleIds === null || visibleIds.includes(ticket.raisedById));
          return (
            <div key={ticket.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{ticket.title}</h2>
                  <p className="mt-1 text-sm text-gray-600">{ticket.description}</p>
                  <p className="mt-2 text-xs text-gray-400">
                    Raised by {ticket.raisedBy.name} ·{' '}
                    {ticket.createdAt.toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </p>
                </div>
                <span
                  className={clsx(
                    'shrink-0 rounded-full px-2 py-1 text-xs font-medium',
                    statusStyles[ticket.status]
                  )}
                >
                  {ticket.status.replace('_', ' ')}
                </span>
              </div>

              {ticket.response && (
                <div className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  <span className="font-medium text-gray-900">
                    {ticket.handledBy?.name ?? 'Team'}:
                  </span>{' '}
                  {ticket.response}
                </div>
              )}

              {canRespond && (
                <TicketResponseForm
                  ticketId={ticket.id}
                  status={ticket.status}
                  response={ticket.response}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
