import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleUserIds } from '@/lib/permissions';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  if (lead.convertedClientId) {
    return NextResponse.json({ error: 'This lead has already been converted' }, { status: 400 });
  }

  const visibleIds = await getVisibleUserIds(session.user.id, session.user.role);
  if (visibleIds && !visibleIds.includes(lead.assignedToId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [client] = await prisma.$transaction([
    prisma.client.create({
      data: {
        name: lead.company || lead.name,
        email: lead.email,
        phone: lead.phone,
        ownerId: lead.assignedToId,
      },
    }),
  ]);

  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: { status: 'WON', convertedClientId: client.id },
    include: { convertedClient: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ lead: updatedLead, client });
}
