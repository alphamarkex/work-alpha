import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateOfferLetterPdf } from '@/lib/pdf';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const targetId = params.userId;

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    include: { organization: true },
  });
  if (!target) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Tenant boundary — must hold regardless of role.
  if (target.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isSelf = session.user.id === targetId;
  const isFounder = session.user.role === 'FOUNDER';
  const isManagerOfTarget = session.user.role === 'MANAGER' && target.managerId === session.user.id;

  if (!isSelf && !isFounder && !isManagerOfTarget) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!target.designation || !target.joiningDate || !target.salary) {
    return NextResponse.json(
      { error: 'Employment details are incomplete — ask your admin to fill in designation, salary, and joining date.' },
      { status: 400 }
    );
  }

  const founder = await prisma.user.findFirst({
    where: { role: 'FOUNDER', organizationId: target.organizationId },
    orderBy: { createdAt: 'asc' },
  });

  const pdfBuffer = await generateOfferLetterPdf({
    companyName: target.organization.name,
    employeeName: target.name,
    employeeId: target.employeeId,
    designation: target.designation,
    joiningDate: target.joiningDate,
    salary: Number(target.salary),
    founderName: founder?.name ?? target.organization.name,
  });

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="offer-letter-${target.employeeId}.pdf"`,
    },
  });
}
