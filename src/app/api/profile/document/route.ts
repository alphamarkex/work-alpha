import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get('userId') || session.user.id;

  // Self can always view their own document; otherwise Founder-only (this is
  // sensitive KYC data, not general employee info).
  if (targetUserId !== session.user.id && session.user.role !== 'FOUNDER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: targetUserId },
    select: { idDocumentData: true, idDocumentName: true, idDocumentMimeType: true },
  });

  if (!profile?.idDocumentData) {
    return NextResponse.json({ error: 'No document on file' }, { status: 404 });
  }

  const base64 = profile.idDocumentData.split(',').pop() ?? '';
  const buffer = Buffer.from(base64, 'base64');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': profile.idDocumentMimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${profile.idDocumentName || 'document'}"`,
    },
  });
}
