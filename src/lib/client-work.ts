import { prisma } from './prisma';

export interface ClientWorkRow {
  id: string;
  kind: 'task' | 'subtask';
  title: string;
  assignedTo: string;
  status: string;
  dueDate: Date | null;
  parentTitle?: string;
}

export interface ClientWorkSummary {
  rows: ClientWorkRow[];
  total: number;
  completed: number;
  percentComplete: number;
}

export async function getClientWorkSummary(clientId: string): Promise<ClientWorkSummary> {
  const tasks = await prisma.task.findMany({
    where: { clientId },
    include: {
      assignedTo: { select: { name: true } },
      subtasks: { include: { assignedTo: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const rows: ClientWorkRow[] = [];
  for (const task of tasks) {
    rows.push({
      id: task.id,
      kind: 'task',
      title: task.title,
      assignedTo: task.assignedTo.name,
      status: task.status,
      dueDate: task.dueDate,
    });
    for (const sub of task.subtasks) {
      rows.push({
        id: sub.id,
        kind: 'subtask',
        title: sub.title,
        assignedTo: sub.assignedTo.name,
        status: sub.status,
        dueDate: sub.dueDate,
        parentTitle: task.title,
      });
    }
  }

  const total = rows.length;
  const completed = rows.filter((r) => r.status === 'COMPLETED').length;
  const percentComplete = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { rows, total, completed, percentComplete };
}
