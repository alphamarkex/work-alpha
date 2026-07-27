import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleUserIds } from '@/lib/permissions';
import ClientForm from '@/components/client-form';

export default async function ClientsPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const visibleIds = await getVisibleUserIds(user.id, user.role);
  const where = {
    organizationId: user.organizationId,
    ...(visibleIds ? { ownerId: { in: visibleIds } } : {}),
  };

  const clients = await prisma.client.findMany({
    where,
    include: {
      owner: { select: { name: true } },
      _count: { select: { invoices: true, meetings: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500">Everyone you or your team work with.</p>
        </div>
      </div>

      <ClientForm />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">GSTIN</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Invoices</th>
              <th className="px-4 py-3">Meetings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No clients yet.
                </td>
              </tr>
            )}
            {clients.map((client) => (
              <tr key={client.id}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  <Link href={`/clients/${client.id}`} className="hover:text-brand-600 hover:underline">
                    {client.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{client.gstin ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">
                  {client.email ?? client.phone ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">{client.owner.name}</td>
                <td className="px-4 py-3 text-gray-500">{client._count.invoices}</td>
                <td className="px-4 py-3 text-gray-500">{client._count.meetings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
