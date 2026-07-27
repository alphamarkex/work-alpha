import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageClientPortal } from '@/lib/permissions';
import { sendClientPortalWelcomeEmail } from '@/lib/email';

const createPortalSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canManageClientPortal(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createPortalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { portalUser: true },
  });
  if (!client || client.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
  if (session.user.role === 'MANAGER' && client.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existingEmail && existingEmail.id !== client.portalUser?.id) {
    return NextResponse.json({ error: 'That email is already in use' }, { status: 400 });
  }

  const tempPassword = randomBytes(6).toString('base64url');
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const portalUser = client.portalUser
    ? await prisma.user.update({
        where: { id: client.portalUser.id },
        data: { email: parsed.data.email, passwordHash, mustChangePassword: true, active: true },
      })
    : await prisma.user.create({
        data: {
          organizationId: client.organizationId,
          employeeId: `CLI-${client.id.slice(-8)}`,
          name: client.name,
          email: parsed.data.email,
          passwordHash,
          role: 'CLIENT',
          portalClientId: client.id,
        },
      });

  await sendClientPortalWelcomeEmail({
    to: portalUser.email,
    name: portalUser.name,
    email: portalUser.email,
    temporaryPassword: tempPassword,
    loginUrl: `${process.env.NEXTAUTH_URL || req.nextUrl.origin}/login`,
  });

  return NextResponse.json({ success: true, email: portalUser.email });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canManageClientPortal(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { portalUser: true },
  });
  if (!client || client.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
  if (!client.portalUser) {
    return NextResponse.json({ error: 'No portal login to remove' }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: client.portalUser.id },
    data: { active: false },
  });

  return NextResponse.json({ success: true });
}
