import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleUserIds } from '@/lib/permissions';
import LeadForm from '@/components/lead-form';
import LeadRowActions, { statusStyles } from '@/components/lead-row-actions';
import clsx from 'clsx';

export default async function LeadsPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const visibleIds = await getVisibleUserIds(user.id, user.role);
  const where = visibleIds ? { assignedToId: { in: visibleIds } } : {};

  const [leads, assignees] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        convertedClient: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    // Founders/Managers can route a lead to anyone visible to them; Employees
    // just get themselves (LeadForm hides the picker when this is empty).
    user.role === 'EMPLOYEE'
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: visibleIds ? { id: { in: visibleIds } } : {},
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
        <p className="text-sm text-gray-500">
          Track prospects from first contact through to a won deal — convert any lead straight
          into a client once it closes.
        </p>
      </div>

      <LeadForm assignees={assignees.filter((a) => a.id !== user.id)} />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Assigned to</th>
              <th className="px-4 py-3">Status / actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No leads yet.
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{lead.name}</td>
                <td className="px-4 py-3 text-gray-500">{lead.company || '—'}</td>
                <td className="px-4 py-3 text-gray-500">
                  {lead.email && <div>{lead.email}</div>}
                  {lead.phone && <div>{lead.phone}</div>}
                  {!lead.email && !lead.phone && '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">{lead.source || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{lead.assignedTo.name}</td>
                <td className="px-4 py-3">
                  {lead.convertedClient ? (
                    <span
                      className={clsx('rounded-full px-2 py-1 text-xs font-medium', statusStyles.WON)}
                    >
                      Converted → {lead.convertedClient.name}
                    </span>
                  ) : (
                    <LeadRowActions leadId={lead.id} status={lead.status} converted={false} />
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
