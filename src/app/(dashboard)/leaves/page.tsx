import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleUserIds, canReviewLeaves } from '@/lib/permissions';
import LeaveApplyForm from '@/components/leave-apply-form';
import LeaveRowActions from '@/components/leave-row-actions';
import clsx from 'clsx';

const statusStyles: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export default async function LeavesPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;
  const canReview = canReviewLeaves(user.role);

  const visibleIds = await getVisibleUserIds(user.id, user.role);
  const where = {
    user: { organizationId: user.organizationId },
    ...(visibleIds ? { userId: { in: visibleIds } } : {}),
  };

  const leaveRequests = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Leave</h1>
        <p className="text-sm text-gray-500">
          {canReview
            ? 'Apply for your own leave, and review requests from your team.'
            : 'Apply for leave and track your requests.'}
        </p>
      </div>

      <LeaveApplyForm />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leaveRequests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No leave requests yet.
                </td>
              </tr>
            )}
            {leaveRequests.map((leave) => (
              <tr key={leave.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{leave.user.name}</td>
                <td className="px-4 py-3 text-gray-500">{leave.leaveType}</td>
                <td className="px-4 py-3 text-gray-500">
                  {leave.startDate.toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' })} –{' '}
                  {leave.endDate.toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' })}
                </td>
                <td className="px-4 py-3 text-gray-500">{leave.reason || '—'}</td>
                <td className="px-4 py-3">
                  <span className={clsx('rounded-full px-2 py-1 text-xs font-medium', statusStyles[leave.status])}>
                    {leave.status}
                  </span>
                  {leave.reviewNote && (
                    <div className="mt-1 text-xs text-gray-400">Note: {leave.reviewNote}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <LeaveRowActions
                    leaveId={leave.id}
                    canReview={canReview && leave.user.id !== user.id}
                    isOwn={leave.user.id === user.id}
                    status={leave.status}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
