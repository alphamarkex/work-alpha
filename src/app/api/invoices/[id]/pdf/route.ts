import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getVisibleUserIds } from '@/lib/permissions';
import { generateInvoicePdf } from '@/lib/pdf';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { client: true, organization: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // Tenant boundary — this must hold regardless of role or hierarchy checks.
  if (invoice.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const visibleIds = await getVisibleUserIds(session.user.id, session.user.role);
  if (visibleIds && !visibleIds.includes(invoice.raisedById)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const pdfBuffer = await generateInvoicePdf({
    companyName: invoice.organization.name,
    companyGstin: invoice.organization.gstin || '________________',
    companyAddress: invoice.organization.address || '________________',
    companyEmail: invoice.organization.email || '________________',
    invoiceNo: invoice.invoiceNo,
    createdAt: invoice.createdAt,
    dueDate: invoice.dueDate,
    clientName: invoice.client.name,
    clientGstin: invoice.client.gstin,
    clientAddress: invoice.client.address,
    description: invoice.description,
    sacCode: invoice.sacCode,
    natureOfSupply: invoice.natureOfSupply,
    placeOfSupply: invoice.placeOfSupply,
    amount: Number(invoice.amount),
    gstRate: Number(invoice.gstRate),
    cgstAmount: Number(invoice.cgstAmount),
    sgstAmount: Number(invoice.sgstAmount),
    igstAmount: Number(invoice.igstAmount),
    interState: invoice.interState,
    totalAmount: Number(invoice.totalAmount),
    paidAmount: Number(invoice.paidAmount),
    status: invoice.status,
  });

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNo.replace(/\//g, '-')}.pdf"`,
    },
  });
}
