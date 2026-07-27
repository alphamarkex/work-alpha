import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleUserIds } from '@/lib/permissions';

const createLeadSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedToId: z.string().optional(), // defaults to self
});

const updateLeadSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST']).optional(),
  notes: z.string().optional().nullable(),
  assignedToId: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const visibleIds = await getVisibleUserIds(session.user.id, session.user.role);
  const where = {
    assignedTo: { organizationId: session.user.organizationId },
    ...(visibleIds ? { assignedToId: { in: visibleIds } } : {}),
  };

  const leads = await prisma.lead.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      convertedClient: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ leads });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Anyone may assign a lead to someone else on their visible team (e.g. a
  // Founder/Manager routing a new lead to the right person); defaults to self.
  let assignedToId = session.user.id;
  if (data.assignedToId && data.assignedToId !== session.user.id) {
    const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
    if (!assignee || assignee.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Invalid assignee' }, { status: 400 });
    }
    const visibleIds = await getVisibleUserIds(session.user.id, session.user.role);
    if (visibleIds && !visibleIds.includes(data.assignedToId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    assignedToId = data.assignedToId;
  }

  const lead = await prisma.lead.create({
    data: {
      name: data.name,
      company: data.company ?? null,
      email: data.email || null,
      phone: data.phone ?? null,
      source: data.source ?? null,
      notes: data.notes ?? null,
      assignedToId,
      createdById: session.user.id,
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ lead }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const lead = await prisma.lead.findUnique({ where: { id: data.id }, include: { assignedTo: true } });
  if (!lead || lead.assignedTo.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const visibleIds = await getVisibleUserIds(session.user.id, session.user.role);
  if (visibleIds && !visibleIds.includes(lead.assignedToId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (data.assignedToId) {
    const newAssignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
    if (!newAssignee || newAssignee.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Invalid assignee' }, { status: 400 });
    }
    if (visibleIds && !visibleIds.includes(data.assignedToId)) {
      return NextResponse.json({ error: 'Cannot reassign outside your visible team' }, { status: 403 });
    }
  }

  const updated = await prisma.lead.update({
    where: { id: data.id },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.assignedToId ? { assignedToId: data.assignedToId } : {}),
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      convertedClient: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ lead: updated });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id }, include: { assignedTo: true } });
  if (!lead || lead.assignedTo.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const visibleIds = await getVisibleUserIds(session.user.id, session.user.role);
  if (visibleIds && !visibleIds.includes(lead.assignedToId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.lead.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
