// Placeholder: src/lib/permissions.ts

import { Role } from '@prisma/client';
import { prisma } from './prisma';

export function canManageEmployees(role: Role) {
  return role === 'FOUNDER' || role === 'MANAGER';
}

// Editing an existing employee's details, deactivating them, or resetting
// their password is Founder-only — Managers can only add new employees.
export function canEditEmployees(role: Role) {
  return role === 'FOUNDER';
}

export function canViewAllClients(role: Role) {
  return role === 'FOUNDER';
}

export function canDeleteInvoice(role: Role) {
  return role === 'FOUNDER';
}

// Only Founders hand out top-level Tasks (to Managers).
export function canAssignTasks(role: Role) {
  return role === 'FOUNDER';
}

// Sub-tasks can be delegated by whoever currently holds the parent task (or
// an existing sub-task under it) to any other active teammate — not
// restricted to Managers or to direct reports. Ownership is checked
// per-request in the API route since it depends on the specific task.
export function canAssignSubtasks(_role: Role) {
  return true;
}

// The Founder's workspace — finances, expense tracker, company-wide numbers.
export function canViewFinances(role: Role) {
  return role === 'FOUNDER';
}

export function canManageExpenses(role: Role) {
  return role === 'FOUNDER';
}

// Who can send ad-hoc emails from inside the app.
export function canSendEmails(role: Role) {
  return role === 'FOUNDER' || role === 'MANAGER';
}

// Who can respond to / resolve tickets raised by their team.
export function canHandleTickets(role: Role) {
  return role === 'FOUNDER' || role === 'MANAGER';
}

// Returns the list of user IDs whose data a given user is allowed to see
export async function getVisibleUserIds(userId: string, role: Role): Promise<string[] | null> {
  if (role === 'FOUNDER') return null; // null = no restriction, sees everyone

  if (role === 'MANAGER') {
    const reports = await prisma.user.findMany({
      where: { managerId: userId },
      select: { id: true },
    });
    return [userId, ...reports.map((r) => r.id)];
  }

  // EMPLOYEE — only themselves
  return [userId];
}