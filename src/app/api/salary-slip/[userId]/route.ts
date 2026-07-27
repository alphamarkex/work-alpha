import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateSalarySlipPdf } from '@/lib/pdf';

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

  if (!target.designation || !target.salary) {
    return NextResponse.json(
      { error: 'Salary details are incomplete — ask your admin to set designation and salary.' },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get('month'); // "YYYY-MM"
  const monthDate = monthParam ? new Date(`${monthParam}-01`) : new Date();
  const monthLabel = monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const pdfBuffer = await generateSalarySlipPdf({
    companyName: target.organization.name,
    companyAddress: target.organization.address || '',
    employeeName: target.name,
    employeeId: target.employeeId,
    designation: target.designation,
    monthLabel,
    grossSalary: Number(target.salary),
    deductions: 0,
  });

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="salary-slip-${target.employeeId}-${monthDate.toISOString().slice(0, 7)}.pdf"`,
    },
  });
}
