import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleUserIds } from '@/lib/permissions';
import { formatInr } from '@/lib/gst';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const visibleIds = await getVisibleUserIds(user.id, user.role);
  const ownerFilter = visibleIds ? { ownerId: { in: visibleIds } } : {};
  const raisedByFilter = visibleIds ? { raisedById: { in: visibleIds } } : {};
  const hostFilter = visibleIds ? { hostId: { in: visibleIds } } : {};

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [clientCount, invoiceStats, upcomingMeetings, overdueInvoices, pendingBalanceInvoices] = await Promise.all([
    prisma.client.count({ where: ownerFilter }),
    prisma.invoice.groupBy({
      by: ['status'],
      where: raisedByFilter,
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.meeting.findMany({
      where: { ...hostFilter, scheduledAt: { gte: now, lte: in7Days } },
      include: { client: true },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    }),
    prisma.invoice.count({
      where: { ...raisedByFilter, status: 'OVERDUE' },
    }),
    prisma.invoice.findMany({
      where: { ...raisedByFilter, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
      include: { client: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 8,
    }),
  ]);

  const pending = invoiceStats.find((s) => s.status === 'PENDING');
  const paid = invoiceStats.find((s) => s.status === 'PAID');

  const cards = [
    { label: 'Clients', value: clientCount, href: '/clients' },
    {
      label: 'Pending invoices',
      value: `${pending?._count._all ?? 0} · ${formatInr(Number(pending?._sum.totalAmount ?? 0))}`,
      href: '/invoices',
    },
    { label: 'Overdue invoices', value: overdueInvoices, href: '/invoices' },
    {
      label: 'Paid (all time)',
      value: formatInr(Number(paid?._sum.totalAmount ?? 0)),
      href: '/invoices',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Welcome back, {user.name.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500">Here's what's happening across your workspace.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="text-sm text-gray-500">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{card.value}</div>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Payment reminders</h2>
          <Link href="/invoices" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            View all invoices
          </Link>
        </div>

        {pendingBalanceInvoices.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing outstanding — all invoices are settled.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {pendingBalanceInvoices.map((invoice) => {
              const remaining = Number(invoice.totalAmount) - Number(invoice.paidAmount);
              const isOverdue = invoice.dueDate < now;
              return (
                <li key={invoice.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium text-gray-900">
                      {invoice.invoiceNo} · {invoice.client.name}
                    </div>
                    <div className={`text-sm ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                      Due {invoice.dueDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      {isOverdue ? ' · Overdue' : ''}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {formatInr(remaining)} remaining
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Upcoming meetings (next 7 days)</h2>
          <Link href="/meetings" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            View all
          </Link>
        </div>

        {upcomingMeetings.length === 0 ? (
          <p className="text-sm text-gray-500">No meetings scheduled in the next week.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {upcomingMeetings.map((meeting) => (
              <li key={meeting.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-gray-900">{meeting.title}</div>
                  <div className="text-sm text-gray-500">
                    {meeting.client?.name ?? 'No client linked'}
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {meeting.scheduledAt.toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
