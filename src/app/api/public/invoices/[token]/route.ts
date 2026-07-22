import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateInvoicePdf } from '@/lib/pdf';
import { COMPANY } from '@/lib/company';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { publicToken: params.token },
    include: { client: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const pdfBuffer = await generateInvoicePdf({
    companyName: COMPANY.name,
    companyGstin: COMPANY.gstin,
    companyAddress: COMPANY.address,
    companyEmail: COMPANY.email,
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
      'Content-Disposition': `inline; filename="${invoice.invoiceNo.replace(/\//g, '-')}.pdf"`,
    },
  });
}
