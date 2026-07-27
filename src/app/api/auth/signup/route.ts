import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const signupSchema = z.object({
  companyName: z.string().min(1),
  founderName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { companyName, founderName, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'That email is already registered' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Founders set their own password at signup, so they skip the forced
  // change-password screen — but still go through profile/KYC setup.
  const { organization, founder } = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: companyName },
    });

    const founder = await tx.user.create({
      data: {
        organizationId: organization.id,
        employeeId: 'FND-0001',
        name: founderName,
        email,
        passwordHash,
        role: 'FOUNDER',
        mustChangePassword: false,
      },
    });

    return { organization, founder };
  });

  return NextResponse.json({ success: true, organizationId: organization.id, userId: founder.id });
}
