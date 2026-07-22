import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canViewFinances } from '@/lib/permissions';
import { formatInr } from '@/lib/gst';
import ExpenseForm from '@/components/expense-form';
import SendEmailForm from '@/components/send-email-form';
import clsx from 'clsx';

export default async function FinancesPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;

  if (!canViewFinances(user.role)) {
    redirect('/dashboard');
  }

  const [invoiceStats, expenses, allUsers, clientCount, employeeCount] = await Promise.all([
    prisma.invoice.groupBy({
      by: ['status'],
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.expense.findMany({
      include: { addedBy: { select: { name: true } } },
      orderBy: { expenseDate: 'desc' },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    prisma.client.count(),
    prisma.user.count({ where: { role: { in: ['MANAGER', 'EMPLOYEE'] }, active: true } }),
  ]);

  const paidTotal = Number(invoiceStats.find((s) => s.status === 'PAID')?._sum.totalAmount ?? 0);
  const pendingTotal = Number(invoiceStats.find((s) => s.status === 'PENDING')?._sum.totalAmount ?? 0);
  const overdueTotal = Number(invoiceStats.find((s) => s.status === 'OVERDUE')?._sum.totalAmount ?? 0);
  const partialTotal = Number(invoiceStats.find((s) => s.status === 'PARTIAL')?._sum.totalAmount ?? 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const netProfit = paidTotal - totalExpenses;

  const expensesByCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
    return acc;
  }, {});

  const cards = [
    { label: 'Revenue collected (paid)', value: formatInr(paidTotal), tone: 'text-green-700' },
    { label: 'Pending + overdue', value: formatInr(pendingTotal + overdueTotal), tone: 'text-yellow-700' },
    { label: 'Total expenses', value: formatInr(totalExpenses), tone: 'text-red-700' },
    {
      label: 'Net profit (paid − expenses)',
      value: formatInr(netProfit),
      tone: netProfit >= 0 ? 'text-green-700' : 'text-red-700',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Finances</h1>
        <p className="text-sm text-gray-500">
          Full workspace overview — revenue, expenses, and the whole team, at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">{card.label}</div>
            <div className={clsx('mt-2 text-2xl font-semibold', card.tone)}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Clients</div>
          <div className="mt-2 text-xl font-semibold text-gray-900">{clientCount}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Team (Managers + Employees)</div>
          <div className="mt-2 text-xl font-semibold text-gray-900">{employeeCount}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Invoices (all time)</div>
          <div className="mt-2 text-xl font-semibold text-gray-900">
            {invoiceStats.reduce((sum, s) => sum + s._count._all, 0)}
          </div>
        </div>
      </div>

      {Object.keys(expensesByCategory).length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Expenses by category</h2>
          <div className="space-y-2">
            {Object.entries(expensesByCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{category.replace('_', ' ')}</span>
                  <span className="font-medium text-gray-900">{formatInr(amount)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Expense tracker</h2>
        <ExpenseForm />
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Added by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No expenses logged yet.
                  </td>
                </tr>
              )}
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{expense.title}</td>
                  <td className="px-4 py-3 text-gray-500">{expense.category.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-gray-500">{formatInr(Number(expense.amount))}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {expense.expenseDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{expense.addedBy.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Send an email</h2>
        <p className="mb-3 text-sm text-gray-500">
          Send an email straight from the workspace — to a teammate, a client, or anyone else.
        </p>
        <SendEmailForm recipients={allUsers} />
      </div>
    </div>
  );
}
