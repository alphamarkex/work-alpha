import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canEditEmployees } from '@/lib/permissions';
import { sendPasswordResetByAdminEmail } from '@/lib/email';

const resetSchema = z.object({
  id: z.string().min(1),
});

function generateTempPassword(): string {
  // 12 random alphanumeric-ish chars, readable enough to type from an email.
  return randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canEditEmployees(session.user.role)) {
    return NextResponse.json({ error: 'Only Founders can reset passwords' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const employee = await prisma.user.findUnique({ where: { id: parsed.data.id } });
  if (!employee || employee.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  await prisma.user.update({
    where: { id: employee.id },
    data: { passwordHash, mustChangePassword: true },
  });

  const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;
  const result = await sendPasswordResetByAdminEmail({
    to: employee.email,
    name: employee.name,
    temporaryPassword: tempPassword,
    loginUrl: `${baseUrl}/login`,
  });
  if (!result.sent) {
    console.error(`[reset-password] Failed to email ${employee.email}:`, result.error);
  }

  return NextResponse.json({ success: true, emailSent: result.sent });
}
