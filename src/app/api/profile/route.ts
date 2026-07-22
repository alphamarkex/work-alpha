import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const profileSchema = z.object({
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  markComplete: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  return NextResponse.json({ profile });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Note: this route only ever touches personal fields (phone, address, DOB,
  // bio, emergency contact). Role, designation, salary, and joiningDate live
  // on the User model and are never writable from here.
  const profile = await prisma.profile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      phone: data.phone ?? null,
      address: data.address ?? null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      bio: data.bio ?? null,
      emergencyContactName: data.emergencyContactName ?? null,
      emergencyContactPhone: data.emergencyContactPhone ?? null,
      completedAt: data.markComplete ? new Date() : null,
    },
    update: {
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.dateOfBirth !== undefined
        ? { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null }
        : {}),
      ...(data.bio !== undefined ? { bio: data.bio } : {}),
      ...(data.emergencyContactName !== undefined
        ? { emergencyContactName: data.emergencyContactName }
        : {}),
      ...(data.emergencyContactPhone !== undefined
        ? { emergencyContactPhone: data.emergencyContactPhone }
        : {}),
      ...(data.markComplete ? { completedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({ profile });
}
