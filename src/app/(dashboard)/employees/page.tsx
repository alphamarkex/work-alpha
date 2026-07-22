import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageEmployees, canEditEmployees } from '@/lib/permissions';
import EmployeeForm from '@/components/employee-form';
import EmployeeRowActions from '@/components/employee-row-actions';
import clsx from 'clsx';

export default async function EmployeesPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;
  const canManage = canManageEmployees(user.role);
  const canEdit = canEditEmployees(user.role);

  const where =
    user.role === 'FOUNDER'
      ? {}
      : user.role === 'MANAGER'
        ? { OR: [{ id: user.id }, { managerId: user.id }] }
        : { id: user.id };

  const employees = await prisma.user.findMany({
    where,
    include: { manager: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const potentialManagers = await prisma.user.findMany({
    where: { role: { in: ['FOUNDER', 'MANAGER'] } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Employees</h1>
        <p className="text-sm text-gray-500">
          {canManage ? 'Manage your team and reporting lines.' : 'Your profile.'}
        </p>
      </div>

      {canManage && (
        <EmployeeForm managers={potentialManagers} canAssignRoles={user.role === 'FOUNDER'} />
      )}

      <div className="overflow-visible rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Employee ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Manager</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Offer letter</th>
              <th className="px-4 py-3">Salary slip</th>
              {canEdit && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{employee.employeeId}</td>
                <td className="px-4 py-3 text-gray-500">{employee.name}</td>
                <td className="px-4 py-3 text-gray-500">{employee.email}</td>
                <td className="px-4 py-3 text-gray-500">{employee.role}</td>
                <td className="px-4 py-3 text-gray-500">{employee.manager?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      'rounded-full px-2 py-1 text-xs font-medium',
                      employee.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {employee.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {employee.designation && employee.joiningDate ? (
                    <a
                      href={`/api/offer-letter/${employee.id}`}
                      className="text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">Incomplete</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {employee.designation && employee.salary ? (
                    <a
                      href={`/api/salary-slip/${employee.id}`}
                      className="text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">Incomplete</span>
                  )}
                </td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <EmployeeRowActions
                      employee={{
                        id: employee.id,
                        name: employee.name,
                        email: employee.email,
                        role: employee.role,
                        managerId: employee.managerId,
                        designation: employee.designation,
                        salary: employee.salary ? Number(employee.salary) : null,
                        joiningDate: employee.joiningDate
                          ? employee.joiningDate.toISOString().slice(0, 10)
                          : null,
                        active: employee.active,
                      }}
                      managers={potentialManagers.filter((m) => m.id !== employee.id)}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
