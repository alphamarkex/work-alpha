import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageExpenses } from '@/lib/permissions';

const EXPENSE_CATEGORIES = [
  'SALARY',
  'RENT',
  'UTILITIES',
  'SOFTWARE',
  'MARKETING',
  'TRAVEL',
  'OFFICE_SUPPLIES',
  'PROFESSIONAL_FEES',
  'OTHER',
] as const;

const createExpenseSchema = z.object({
  title: z.string().min(1),
  category: z.enum(EXPENSE_CATEGORIES).default('OTHER'),
  amount: z.number().positive(),
  expenseDate: z.string(), // ISO date string
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canManageExpenses(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const expenses = await prisma.expense.findMany({
    include: { addedBy: { select: { id: true, name: true } } },
    orderBy: { expenseDate: 'desc' },
  });

  return NextResponse.json({ expenses });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canManageExpenses(session.user.role)) {
    return NextResponse.json({ error: 'Only Founders can log expenses' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const expense = await prisma.expense.create({
    data: {
      title: data.title,
      category: data.category,
      amount: data.amount,
      expenseDate: new Date(data.expenseDate),
      notes: data.notes ?? null,
      addedById: session.user.id,
    },
  });

  return NextResponse.json({ expense }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canManageExpenses(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing expense id' }, { status: 400 });
  }

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
