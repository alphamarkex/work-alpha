import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleUserIds, canDeleteInvoice } from '@/lib/permissions';
import { calculateGst, generateInvoiceNo, getFinancialYearRange, DEFAULT_GST_RATE } from '@/lib/gst';

const createInvoiceSchema = z.object({
  clientId: z.string().min(1),
  description: z.string().optional().nullable(),
  amount: z.number().positive(),
  gstRate: z.number().min(0).max(100).default(DEFAULT_GST_RATE),
  dueDate: z.string(), // ISO date string
  interState: z.boolean().optional().default(false),
  sacCode: z.string().optional().default('998314'),
  natureOfSupply: z.enum(['B2B', 'B2C']).optional().default('B2B'),
  placeOfSupply: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const visibleIds = await getVisibleUserIds(session.user.id, session.user.role);
  const where = {
    organizationId: session.user.organizationId,
    ...(visibleIds ? { raisedById: { in: visibleIds } } : {}),
  };

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const clientId = searchParams.get('clientId');

  const invoices = await prisma.invoice.findMany({
    where: {
      ...where,
      ...(status ? { status: status as any } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: {
      client: { select: { id: true, name: true, gstin: true } },
      raisedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ invoices });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const { organizationId } = session.user;

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client || client.organizationId !== organizationId) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // An employee may only invoice their own clients; managers/founders may invoice anyone visible to them.
  const visibleIds = await getVisibleUserIds(session.user.id, session.user.role);
  if (visibleIds && !visibleIds.includes(client.ownerId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const breakdown = calculateGst(data.amount, data.gstRate, data.interState);

  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const { start: fyStart } = getFinancialYearRange();
  const countThisFY = await prisma.invoice.count({
    where: { organizationId, createdAt: { gte: fyStart } },
  });
  const invoiceNo = generateInvoiceNo(countThisFY, organization.name);

  const invoice = await prisma.invoice.create({
    data: {
      organizationId,
      invoiceNo,
      clientId: data.clientId,
      raisedById: session.user.id,
      description: data.description ?? null,
      amount: breakdown.amount,
      gstRate: breakdown.gstRate,
      gstAmount: breakdown.gstAmount,
      cgstAmount: breakdown.cgst,
      sgstAmount: breakdown.sgst,
      igstAmount: breakdown.igst,
      interState: data.interState,
      sacCode: data.sacCode || '998314',
      natureOfSupply: data.natureOfSupply,
      placeOfSupply: data.placeOfSupply ?? null,
      totalAmount: breakdown.totalAmount,
      dueDate: new Date(data.dueDate),
    },
    include: {
      client: { select: { id: true, name: true, gstin: true } },
    },
  });

  return NextResponse.json({ invoice }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canDeleteInvoice(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice || invoice.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  await prisma.invoice.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
