import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAssignTasks } from '@/lib/permissions';
import { sendTaskAssignedEmail } from '@/lib/email';

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  assignedToId: z.string().min(1),
  dueDate: z.string().optional().nullable(), // ISO date string
  clientId: z.string().optional().nullable(),
});

const updateTaskSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED']).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, role } = session.user;

  // Founders see every task they've handed out; Managers see tasks handed to
  // them; Employees see the parent tasks behind the sub-tasks assigned to them.
  const where =
    role === 'FOUNDER'
      ? {}
      : role === 'MANAGER'
        ? { assignedToId: id }
        : { subtasks: { some: { assignedToId: id } } };

  const tasks = await prisma.task.findMany({
    where,
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
        ...(role === 'EMPLOYEE' ? { where: { assignedToId: id } } : {}),
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canAssignTasks(session.user.role)) {
    return NextResponse.json({ error: 'Only Founders can assign tasks' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const manager = await prisma.user.findUnique({ where: { id: data.assignedToId } });
  if (!manager || manager.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Tasks can only be assigned to a Manager' }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      assignedById: session.user.id,
      assignedToId: data.assignedToId,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      clientId: data.clientId || null,
    },
    include: {
      assignedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      client: { select: { id: true, name: true } },
    },
  });

  // Best-effort notification — failure to email should not fail task creation.
  await sendTaskAssignedEmail({
    to: task.assignedTo.email,
    managerName: task.assignedTo.name,
    founderName: task.assignedBy.name,
    taskTitle: task.title,
    taskDescription: task.description,
    dueDate: task.dueDate,
  });

  return NextResponse.json({ task }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const task = await prisma.task.findUnique({ where: { id: data.id } });
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const isFounder = session.user.role === 'FOUNDER';
  const isOwningManager = session.user.id === task.assignedToId;
  if (!isFounder && !isOwningManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await prisma.task.update({
    where: { id: data.id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.status === 'COMPLETED' ? { completedAt: new Date() } : {}),
      ...(data.status && data.status !== 'COMPLETED' ? { completedAt: null } : {}),
      ...(data.title ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
    },
    include: {
      assignedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ task: updated });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canAssignTasks(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing task id' }, { status: 400 });
  }

  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
