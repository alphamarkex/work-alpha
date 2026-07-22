import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateOfferLetterPdf } from '@/lib/pdf';
import { COMPANY } from '@/lib/company';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const targetId = params.userId;

  const isSelf = session.user.id === targetId;
  const isFounder = session.user.role === 'FOUNDER';

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

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

  const founder = await prisma.user.findFirst({ where: { role: 'FOUNDER' }, orderBy: { createdAt: 'asc' } });

  const pdfBuffer = await generateOfferLetterPdf({
    companyName: COMPANY.name,
    employeeName: target.name,
    employeeId: target.employeeId,
    designation: target.designation,
    joiningDate: target.joiningDate,
    salary: Number(target.salary),
    founderName: founder?.name ?? COMPANY.name,
  });

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="offer-letter-${target.employeeId}.pdf"`,
    },
  });
}
