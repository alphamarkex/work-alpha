import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageEmployees, canEditEmployees } from '@/lib/permissions';
import { sendWelcomeEmail } from '@/lib/email';

const createEmployeeSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['FOUNDER', 'MANAGER', 'EMPLOYEE']).default('EMPLOYEE'),
  managerId: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  salary: z.number().positive().optional().nullable(),
  joiningDate: z.string().optional().nullable(),
});

const updateEmployeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['FOUNDER', 'MANAGER', 'EMPLOYEE']).optional(),
  managerId: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  salary: z.number().positive().optional().nullable(),
  joiningDate: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role, id, organizationId } = session.user;

  // Founders see everyone in their own organization (never another
  // company's); managers see their direct reports; employees see themselves.
  const where =
    role === 'FOUNDER'
      ? { organizationId }
      : role === 'MANAGER'
        ? { organizationId, OR: [{ id }, { managerId: id }] }
        : { organizationId, id };

  const employees = await prisma.user.findMany({
    where,
    select: {
      id: true,
      employeeId: true,
      name: true,
      email: true,
      role: true,
      active: true,
      managerId: true,
      designation: true,
      joiningDate: true,
      createdAt: true,
      manager: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ employees });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canManageEmployees(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const { organizationId } = session.user;

  // Only founders can create other founders or managers.
  if (data.role !== 'EMPLOYEE' && session.user.role !== 'FOUNDER') {
    return NextResponse.json(
      { error: 'Only founders can create managers or founders' },
      { status: 403 }
    );
  }

  // A manager assigned to the new hire must belong to the same organization.
  if (data.managerId) {
    const manager = await prisma.user.findUnique({ where: { id: data.managerId } });
    if (!manager || manager.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Invalid manager' }, { status: 400 });
    }
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingEmail) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
  }
  const existingEmployeeId = await prisma.user.findUnique({
    where: { organizationId_employeeId: { organizationId, employeeId: data.employeeId } },
  });
  if (existingEmployeeId) {
    return NextResponse.json({ error: 'Employee ID already in use' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const employee = await prisma.user.create({
    data: {
      organizationId,
      employeeId: data.employeeId,
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      managerId: data.managerId ?? null,
      designation: data.designation ?? null,
      salary: data.salary ?? null,
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
    },
    select: {
      id: true,
      employeeId: true,
      name: true,
      email: true,
      role: true,
      active: true,
      managerId: true,
      designation: true,
      joiningDate: true,
      createdAt: true,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;
  const result = await sendWelcomeEmail({
    to: employee.email,
    name: employee.name,
    email: employee.email,
    temporaryPassword: data.password,
    loginUrl: `${baseUrl}/login`,
  });
  if (!result.sent) {
    console.error(`[employees] Failed to send welcome email to ${employee.email}:`, result.error);
  }

  return NextResponse.json({ employee }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canEditEmployees(session.user.role)) {
    return NextResponse.json({ error: 'Only Founders can edit employee details' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: data.id } });
  if (!target || target.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (data.email) {
    const existing = await prisma.user.findFirst({
      where: { email: data.email, id: { not: data.id } },
    });
    if (existing) {
      return NextResponse.json({ error: 'That email is already in use' }, { status: 409 });
    }
  }

  const employee = await prisma.user.update({
    where: { id: data.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.managerId !== undefined ? { managerId: data.managerId } : {}),
      ...(data.designation !== undefined ? { designation: data.designation } : {}),
      ...(data.salary !== undefined ? { salary: data.salary } : {}),
      ...(data.joiningDate !== undefined
        ? { joiningDate: data.joiningDate ? new Date(data.joiningDate) : null }
        : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
    select: {
      id: true,
      employeeId: true,
      name: true,
      email: true,
      role: true,
      active: true,
      managerId: true,
      designation: true,
      salary: true,
      joiningDate: true,
    },
  });

  return NextResponse.json({ employee });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canEditEmployees(session.user.role)) {
    return NextResponse.json({ error: 'Only Founders can remove employees' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing employee id' }, { status: 400 });
  }

  if (id === session.user.id) {
    return NextResponse.json({ error: "You can't remove your own account" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Soft-delete: deactivate rather than hard-delete, since employees are
  // referenced by invoices, tasks, tickets, attendance history, etc.
  const employee = await prisma.user.update({
    where: { id },
    data: { active: false },
    select: { id: true, name: true, active: true },
  });

  return NextResponse.json({ employee });
}
