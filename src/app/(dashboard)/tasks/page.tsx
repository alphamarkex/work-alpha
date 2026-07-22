import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import TaskForm from '@/components/task-form';
import SubtaskForm from '@/components/subtask-form';
import StatusControl from '@/components/status-control';

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const taskWhere =
    user.role === 'FOUNDER'
      ? {}
      : {
          OR: [
            { assignedToId: user.id },
            { subtasks: { some: { assignedToId: user.id } } },
            { subtasks: { some: { assignedById: user.id } } },
          ],
        };

  const [tasks, managers, allActiveUsers, clients] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
      include: {
        assignedBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        subtasks: {
          include: {
            assignedBy: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    user.role === 'FOUNDER'
      ? prisma.user.findMany({
          where: { role: 'MANAGER', active: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
    // Any active teammate can be a sub-task delegate target — not limited to
    // direct reports, so this is the full active roster minus the viewer.
    prisma.user.findMany({
      where: { active: true, id: { not: user.id } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    user.role === 'FOUNDER'
      ? prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
  ]);

  const intro =
    user.role === 'FOUNDER'
      ? 'Hand tasks down to your Managers. Anyone holding a task or sub-task can delegate pieces of it to any teammate.'
      : 'Tasks and sub-tasks you hold or have delegated. Anyone holding a task can pass pieces of it to any teammate.';

  // Flattened "who's doing what, for which brand" rows — Founder-only view.
  const workRows =
    user.role === 'FOUNDER'
      ? tasks.flatMap((task) => {
          const rows = [
            {
              key: task.id,
              person: task.assignedTo.name,
              work: task.title,
              brand: task.client?.name ?? '— internal —',
              status: task.status,
            },
          ];
          for (const sub of task.subtasks) {
            rows.push({
              key: sub.id,
              person: sub.assignedTo.name,
              work: `${sub.title} (under "${task.title}")`,
              brand: task.client?.name ?? '— internal —',
              status: sub.status,
            });
          }
          return rows;
        })
      : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Tasks</h1>
        <p className="text-sm text-gray-500">{intro}</p>
      </div>

      {user.role === 'FOUNDER' && <TaskForm managers={managers} clients={clients} />}

      {user.role === 'FOUNDER' && workRows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Who's doing what, for which brand</h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Team member</th>
                <th className="px-4 py-3">Work</th>
                <th className="px-4 py-3">Brand / client</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workRows.map((row) => (
                <tr key={row.key}>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.person}</td>
                  <td className="px-4 py-3 text-gray-600">{row.work}</td>
                  <td className="px-4 py-3 text-gray-500">{row.brand}</td>
                  <td className="px-4 py-3 text-gray-500">{row.status.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tasks.length === 0 && (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
          No tasks yet.
        </p>
      )}

      <div className="space-y-4">
        {tasks.map((task) => {
          const canEditTaskStatus = user.role === 'FOUNDER' || user.id === task.assignedToId;
          const holdsTask = task.assignedToId === user.id;
          const holdsSubtaskUnderTask = task.subtasks.some((s) => s.assignedToId === user.id);
          const canDelegate = user.role === 'FOUNDER' || holdsTask || holdsSubtaskUnderTask;

          return (
            <div key={task.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{task.title}</h2>
                  {task.description && (
                    <p className="mt-1 text-sm text-gray-500">{task.description}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    {task.assignedBy.name} → {task.assignedTo.name}
                    {task.client && ` · Brand: ${task.client.name}`}
                    {task.dueDate &&
                      ` · Due ${task.dueDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}`}
                  </p>
                </div>
                <StatusControl
                  kind="task"
                  id={task.id}
                  status={task.status}
                  disabled={!canEditTaskStatus}
                />
              </div>

              {task.subtasks.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                  {task.subtasks.map((sub) => {
                    const canEditSubStatus =
                      user.role === 'FOUNDER' || user.id === sub.assignedToId || user.id === sub.assignedById;
                    return (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-800">{sub.title}</div>
                          <div className="text-xs text-gray-400">
                            {sub.assignedBy.name} → {sub.assignedTo.name}
                            {sub.dueDate &&
                              ` · Due ${sub.dueDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}`}
                          </div>
                        </div>
                        <StatusControl
                          kind="subtask"
                          id={sub.id}
                          status={sub.status}
                          disabled={!canEditSubStatus}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {canDelegate && <SubtaskForm taskId={task.id} employees={allActiveUsers} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
