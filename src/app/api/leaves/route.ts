import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleUserIds, canReviewLeaves } from '@/lib/permissions';
import { sendEmail } from '@/lib/email';

const applyLeaveSchema = z.object({
  leaveType: z.enum(['SICK', 'CASUAL', 'EARNED', 'UNPAID', 'OTHER']).default('CASUAL'),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional().nullable(),
});

const reviewLeaveSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['APPROVED', 'REJECTED', 'CANCELLED']),
  reviewNote: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, role, organizationId } = session.user;

  // Founders/Managers see their visible team's requests (for approving);
  // everyone always sees their own regardless.
  const visibleIds = await getVisibleUserIds(id, role);
  const where = {
    user: { organizationId },
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

  return NextResponse.json({ leaveRequests });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = applyLeaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);

  if (endDate < startDate) {
    return NextResponse.json({ error: 'End date must be on or after the start date' }, { status: 400 });
  }

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      userId: session.user.id,
      leaveType: data.leaveType,
      startDate,
      endDate,
      reason: data.reason ?? null,
    },
    include: { user: { select: { id: true, name: true, email: true, managerId: true } } },
  });

  // Best-effort notification to the requester's manager (or any Founder if they have none).
  const notifyTarget = leaveRequest.user.managerId
    ? await prisma.user.findUnique({ where: { id: leaveRequest.user.managerId } })
    : await prisma.user.findFirst({
        where: { role: 'FOUNDER', organizationId: session.user.organizationId },
      });

  if (notifyTarget?.email) {
    await sendEmail({
      to: notifyTarget.email,
      subject: `Leave request from ${leaveRequest.user.name}`,
      text: [
        `${leaveRequest.user.name} has requested leave.`,
        ``,
        `Type: ${data.leaveType}`,
        `From: ${startDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}`,
        `To: ${endDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}`,
        data.reason ? `Reason: ${data.reason}` : null,
        ``,
        `Review it in the workspace under Leave.`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  return NextResponse.json({ leaveRequest }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = reviewLeaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id: data.id },
    include: { user: true },
  });
  if (!leaveRequest || leaveRequest.user.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
  }

  const isOwnRequest = leaveRequest.userId === session.user.id;

  // Anyone can cancel their own still-pending request; approving/rejecting
  // someone else's requires review permission and visibility over them.
  if (data.status === 'CANCELLED') {
    if (!isOwnRequest) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else {
    if (!canReviewLeaves(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const visibleIds = await getVisibleUserIds(session.user.id, session.user.role);
    if (visibleIds && !visibleIds.includes(leaveRequest.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const updated = await prisma.leaveRequest.update({
    where: { id: data.id },
    data: {
      status: data.status,
      reviewNote: data.reviewNote ?? null,
      reviewedById: data.status === 'CANCELLED' ? leaveRequest.reviewedById : session.user.id,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  });

  if (data.status !== 'CANCELLED' && updated.user.email) {
    await sendEmail({
      to: updated.user.email,
      subject: `Your leave request was ${data.status.toLowerCase()}`,
      text: [
        `Your leave request (${updated.startDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })} – ${updated.endDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}) was ${data.status.toLowerCase()}.`,
        data.reviewNote ? `Note: ${data.reviewNote}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  return NextResponse.json({ leaveRequest: updated });
}
