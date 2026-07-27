import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const doc = await prisma.clientDocument.findUnique({
    where: { id: params.docId },
    include: { client: true },
  });
  if (!doc || doc.clientId !== params.id) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  if (doc.client.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const role = session.user.role;
  let allowed = role === 'FOUNDER';
  if (!allowed && role === 'CLIENT') {
    const portalUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    allowed = portalUser?.portalClientId === params.id;
  }
  if (!allowed && (role === 'MANAGER' || role === 'EMPLOYEE')) {
    const client = await prisma.client.findUnique({ where: { id: params.id } });
    allowed = client?.ownerId === session.user.id;
  }

  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const base64 = doc.data.split(',').pop() ?? '';
  const buffer = Buffer.from(base64, 'base64');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': doc.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${doc.name}"`,
    },
  });
}
