import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getClientWorkSummary } from '@/lib/client-work';
import ClientDocumentUpload from '@/components/client-document-upload';
import clsx from 'clsx';

const statusStyles: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  BLOCKED: 'bg-red-100 text-red-800',
};

export default async function ClientPortalPage() {
  const session = await getServerSession(authOptions);
  const clientId = session!.user.portalClientId;

  if (!clientId) {
    // Shouldn't happen for a CLIENT-role account, but fail safe rather than crash.
    redirect('/login');
  }

  const [client, work, documents] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId! } }),
    getClientWorkSummary(clientId!),
    prisma.clientDocument.findMany({
      where: { clientId: clientId! },
      select: {
        id: true,
        name: true,
        mimeType: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Welcome, {client?.name}</h1>
        <p className="text-sm text-gray-500">Here's where things stand on your work with us.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Progress</h2>
        <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full bg-brand-600" style={{ width: `${work.percentComplete}%` }} />
        </div>
        <p className="text-sm text-gray-600">
          {work.completed} of {work.total} task{work.total === 1 ? '' : 's'} complete (
          {work.percentComplete}%)
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Work in progress</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {work.rows.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-gray-500">
                  Nothing logged yet.
                </td>
              </tr>
            )}
            {work.rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 text-gray-900">
                  {row.title}
                  {row.parentTitle && <span className="text-xs text-gray-400"> ({row.parentTitle})</span>}
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

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Documents</h2>
        <ClientDocumentUpload
          clientId={clientId!}
          documents={documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))}
          canManage={false}
        />
      </div>
    </div>
  );
}
