import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageClientPortal } from '@/lib/permissions';
import { getClientWorkSummary } from '@/lib/client-work';
import ClientDocumentUpload from '@/components/client-document-upload';
import ClientPortalLoginForm from '@/components/client-portal-login-form';
import clsx from 'clsx';

const statusStyles: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  BLOCKED: 'bg-red-100 text-red-800',
};

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session!.user;

  if (user.role === 'CLIENT') {
    redirect('/client-portal');
  }

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { owner: { select: { name: true } }, portalUser: { select: { email: true } } },
  });

  if (!client) {
    redirect('/clients');
  }
  if (client!.organizationId !== user.organizationId) {
    redirect('/clients');
  }
  // Employees/Managers only see clients they own (Founder sees all within their org).
  if (user.role !== 'FOUNDER' && client!.ownerId !== user.id) {
    redirect('/clients');
  }

  const [documents, work] = await Promise.all([
    prisma.clientDocument.findMany({
      where: { clientId: params.id },
      select: {
        id: true,
        name: true,
        mimeType: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    getClientWorkSummary(params.id),
  ]);

  const canManage = canManageClientPortal(user.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{client!.name}</h1>
        <p className="text-sm text-gray-500">
          Owned by {client!.owner.name}
          {client!.gstin && ` · GSTIN ${client!.gstin}`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Contact details</h2>
          <dl className="space-y-1 text-sm text-gray-600">
            <div>Email: {client!.email || '—'}</div>
            <div>Phone: {client!.phone || '—'}</div>
            <div>Address: {client!.address || '—'}</div>
          </dl>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Work progress</h2>
          <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-brand-600"
              style={{ width: `${work.percentComplete}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            {work.completed} of {work.total} task{work.total === 1 ? '' : 's'} complete (
            {work.percentComplete}%)
          </p>
        </div>
      </div>

      {canManage && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Client portal access</h2>
          <ClientPortalLoginForm clientId={client!.id} existingEmail={client!.portalUser?.email ?? null} />
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Documents</h2>
        <ClientDocumentUpload
          clientId={client!.id}
          documents={documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))}
          canManage={canManage}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Tasks for this client</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Work</th>
              <th className="px-4 py-3">Assigned to</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {work.rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                  No tasks assigned for this client yet.
                </td>
              </tr>
            )}
            {work.rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 text-gray-900">
                  {row.title}
                  {row.parentTitle && (
                    <span className="text-xs text-gray-400"> (under "{row.parentTitle}")</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{row.assignedTo}</td>
                <td className="px-4 py-3 text-gray-500">
                  {row.dueDate
                    ? row.dueDate.toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' })
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={clsx('rounded-full px-2 py-1 text-xs font-medium', statusStyles[row.status])}>
                    {row.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
