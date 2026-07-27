import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageClientPortal } from '@/lib/permissions';

const MAX_DOCUMENT_BASE64_LENGTH = 6_000_000; // ~4MB raw file

const uploadSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string().min(1),
  data: z.string().max(MAX_DOCUMENT_BASE64_LENGTH, 'File is too large — please upload something under ~4MB'),
});

async function getAccessibleClient(userId: string, role: string, organizationId: string, clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.organizationId !== organizationId) return null;

  if (role === 'FOUNDER') return client;
  if (role === 'CLIENT') {
    const portalUser = await prisma.user.findUnique({ where: { id: userId } });
    return portalUser?.portalClientId === clientId ? client : null;
  }
  return client.ownerId === userId ? client : null;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await getAccessibleClient(
    session.user.id,
    session.user.role,
    session.user.organizationId,
    params.id
  );
  if (!client) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const documents = await prisma.clientDocument.findMany({
    where: { clientId: params.id },
    select: {
      id: true,
      name: true,
      mimeType: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canManageClientPortal(session.user.role)) {
    return NextResponse.json({ error: 'Only Founders/Managers can upload client documents' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = uploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const client = await getAccessibleClient(
    session.user.id,
    session.user.role,
    session.user.organizationId,
    params.id
  );
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const document = await prisma.clientDocument.create({
    data: {
      clientId: params.id,
      name: parsed.data.name,
      mimeType: parsed.data.mimeType,
      data: parsed.data.data,
      uploadedById: session.user.id,
    },
    select: { id: true, name: true, mimeType: true, createdAt: true },
  });

  return NextResponse.json({ document }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canManageClientPortal(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = await getAccessibleClient(
    session.user.id,
    session.user.role,
    session.user.organizationId,
    params.id
  );
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('docId');
  if (!docId) {
    return NextResponse.json({ error: 'Missing docId' }, { status: 400 });
  }

  const doc = await prisma.clientDocument.findUnique({ where: { id: docId } });
  if (!doc || doc.clientId !== params.id) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  await prisma.clientDocument.delete({ where: { id: docId } });
  return NextResponse.json({ success: true });
}
