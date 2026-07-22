import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendSubtaskAssignedEmail } from '@/lib/email';

const createSubtaskSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  assignedToId: z.string().min(1),
  dueDate: z.string().optional().nullable(),
});

const updateSubtaskSchema = z.object({
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

  const where =
    role === 'FOUNDER'
      ? {}
      : { OR: [{ assignedById: id }, { assignedToId: id }] };

  const subtasks = await prisma.subTask.findMany({
    where,
    include: {
      task: { select: { id: true, title: true } },
      assignedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ subtasks });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSubtaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const task = await prisma.task.findUnique({ where: { id: data.taskId } });
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  // Anyone currently holding this task — the Manager it was assigned to, or
  // anyone already holding a sub-task under it — can delegate a further
  // piece of it to any other active teammate. Founders can always do this.
  const isFounder = session.user.role === 'FOUNDER';
  const holdsTask = task.assignedToId === session.user.id;
  const holdsSubtaskUnderTask = holdsTask
    ? true
    : Boolean(
        await prisma.subTask.findFirst({
          where: { taskId: data.taskId, assignedToId: session.user.id },
          select: { id: true },
        })
      );

  if (!isFounder && !holdsTask && !holdsSubtaskUnderTask) {
    return NextResponse.json(
      { error: "You can only delegate a task you've been assigned (directly or via a sub-task)" },
      { status: 403 }
    );
  }

  const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
  if (!assignee || !assignee.active) {
    return NextResponse.json({ error: 'Assignee not found or inactive' }, { status: 400 });
  }

  const subtask = await prisma.subTask.create({
    data: {
      taskId: data.taskId,
      title: data.title,
      description: data.description ?? null,
      assignedById: session.user.id,
      assignedToId: data.assignedToId,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
    include: {
      task: { select: { id: true, title: true } },
      assignedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  await sendSubtaskAssignedEmail({
    to: subtask.assignedTo.email,
    employeeName: subtask.assignedTo.name,
    managerName: subtask.assignedBy.name,
    parentTaskTitle: subtask.task.title,
    subtaskTitle: subtask.title,
    subtaskDescription: subtask.description,
    dueDate: subtask.dueDate,
  });

  return NextResponse.json({ subtask }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateSubtaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const subtask = await prisma.subTask.findUnique({ where: { id: data.id } });
  if (!subtask) {
    return NextResponse.json({ error: 'Sub-task not found' }, { status: 404 });
  }

  const isFounder = session.user.role === 'FOUNDER';
  const isOwningManager = session.user.id === subtask.assignedById;
  const isAssignedEmployee = session.user.id === subtask.assignedToId;

  if (!isFounder && !isOwningManager && !isAssignedEmployee) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Employees may only update status (mark progress/completion), not the
  // task's content — content edits stay with whoever assigned it.
  const canEditContent = isFounder || isOwningManager;

  const updated = await prisma.subTask.update({
    where: { id: data.id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.status === 'COMPLETED' ? { completedAt: new Date() } : {}),
      ...(data.status && data.status !== 'COMPLETED' ? { completedAt: null } : {}),
      ...(canEditContent && data.title ? { title: data.title } : {}),
      ...(canEditContent && data.description !== undefined ? { description: data.description } : {}),
      ...(canEditContent && data.dueDate !== undefined
        ? { dueDate: data.dueDate ? new Date(data.dueDate) : null }
        : {}),
    },
    include: {
      task: { select: { id: true, title: true } },
      assignedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ subtask: updated });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing sub-task id' }, { status: 400 });
  }

  const subtask = await prisma.subTask.findUnique({ where: { id } });
  if (!subtask) {
    return NextResponse.json({ error: 'Sub-task not found' }, { status: 404 });
  }

  const isFounder = session.user.role === 'FOUNDER';
  const isOwningManager = session.user.id === subtask.assignedById;
  if (!isFounder && !isOwningManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.subTask.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
