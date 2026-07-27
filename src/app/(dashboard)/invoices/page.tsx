import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleUserIds } from '@/lib/permissions';
import { formatInr } from '@/lib/gst';
import InvoiceForm from '@/components/invoice-form';
import clsx from 'clsx';

const statusStyles: Record<string, string> = {
  PAID: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  OVERDUE: 'bg-red-100 text-red-800',
  PARTIAL: 'bg-blue-100 text-blue-800',
};

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const visibleIds = await getVisibleUserIds(user.id, user.role);
  const where = {
    organizationId: user.organizationId,
    ...(visibleIds ? { raisedById: { in: visibleIds } } : {}),
  };
  const clientWhere = {
    organizationId: user.organizationId,
    ...(visibleIds ? { ownerId: { in: visibleIds } } : {}),
  };

  const [invoices, clients] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        client: { select: { name: true } },
        raisedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.client.findMany({
      where: clientWhere,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
        <p className="text-sm text-gray-500">GST-compliant invoices raised across your workspace.</p>
      </div>

      <InvoiceForm clients={clients} />

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">GST</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Due date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Raised by</th>
              <th className="px-4 py-3">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  No invoices yet.
                </td>
              </tr>
            )}
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{invoice.invoiceNo}</td>
                <td className="px-4 py-3 text-gray-500">{invoice.client.name}</td>
                <td className="px-4 py-3 text-gray-500">{formatInr(Number(invoice.amount))}</td>
                <td className="px-4 py-3 text-gray-500">
                  {formatInr(Number(invoice.gstAmount))} ({Number(invoice.gstRate)}%)
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {formatInr(Number(invoice.totalAmount))}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {invoice.dueDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      'rounded-full px-2 py-1 text-xs font-medium',
                      statusStyles[invoice.status]
                    )}
                  >
                    {invoice.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{invoice.raisedBy.name}</td>
                <td className="px-4 py-3">
                  <a
                    href={`/api/invoices/${invoice.id}/pdf`}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Download
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
