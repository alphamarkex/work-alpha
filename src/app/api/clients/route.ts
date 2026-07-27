import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleUserIds } from '@/lib/permissions';
import { isValidGstin } from '@/lib/gst';

const createClientSchema = z.object({
  name: z.string().min(1),
  gstin: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  ownerId: z.string().optional(), // founders/managers may assign to a specific owner
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const visibleIds = await getVisibleUserIds(session.user.id, session.user.role);
  const where = {
    organizationId: session.user.organizationId,
    ...(visibleIds ? { ownerId: { in: visibleIds } } : {}),
  };

  const clients = await prisma.client.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { invoices: true, meetings: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  if (data.gstin && !isValidGstin(data.gstin)) {
    return NextResponse.json({ error: 'Invalid GSTIN format' }, { status: 400 });
  }

  // Only founders/managers may create a client on behalf of someone else —
  // and only someone in the same organization.
  let ownerId = session.user.id;
  if (data.ownerId && data.ownerId !== session.user.id) {
    if (session.user.role === 'EMPLOYEE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const owner = await prisma.user.findUnique({ where: { id: data.ownerId } });
    if (!owner || owner.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Invalid owner' }, { status: 400 });
    }
    ownerId = data.ownerId;
  }

  const client = await prisma.client.create({
    data: {
      organizationId: session.user.organizationId,
      name: data.name,
      gstin: data.gstin ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      address: data.address ?? null,
      ownerId,
    },
  });

  return NextResponse.json({ client }, { status: 201 });
}
