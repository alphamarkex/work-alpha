import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail, sendMeetingReminderEmail, sendPaymentReminderEmail } from '@/lib/email';
import { sendWhatsApp, sendMeetingReminderWhatsApp, isWhatsAppConfigured } from '@/lib/whatsapp';

// Triggered by the Vercel Cron job configured in vercel.json.
// 1. Sends a reminder (~24h ahead) for each meeting that hasn't been reminded yet.
// 2. Flags any invoice past its due date as OVERDUE.
// 3. Sends a payment reminder to clients with invoices due soon or overdue,
//    re-sending every 3 days until the invoice is settled.

const PAYMENT_REMINDER_WINDOW_DAYS = 3; // remind this many days before the due date
const PAYMENT_REMINDER_COOLDOWN_DAYS = 3; // don't re-remind more often than this

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;
  const now = new Date();

  // ---------- 1. Meeting reminders ----------
  const meetingWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const meetings = await prisma.meeting.findMany({
    where: { reminderSentAt: null, scheduledAt: { gte: now, lte: meetingWindowEnd } },
    include: {
      host: { select: { name: true, email: true, profile: { select: { phone: true } } } },
      client: { select: { name: true, email: true, phone: true } },
    },
  });

  const meetingResults: { meetingId: string; emailSent: boolean; whatsappSent: number }[] = [];

  for (const meeting of meetings) {
    const whenText = meeting.scheduledAt.toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
    const emailRecipients = [meeting.host.email, meeting.client?.email].filter(
      (e): e is string => Boolean(e)
    );

    const emailResult = emailRecipients.length
      ? await sendMeetingReminderEmail({
          to: emailRecipients,
          title: meeting.title,
          whenText,
          clientName: meeting.client?.name,
          notes: meeting.notes,
          meetingLink: meeting.meetingLink,
        })
      : { sent: false };

    let whatsappSent = 0;
    if (isWhatsAppConfigured()) {
      const whatsappNumbers = [meeting.host.profile?.phone, meeting.client?.phone].filter(
        (p): p is string => Boolean(p)
      );
      const fallbackBody = [
        `Reminder: ${meeting.title}`,
        `When: ${whenText}`,
        meeting.meetingLink ? `Join: ${meeting.meetingLink}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      const dateLabel = meeting.scheduledAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
      const timeLabel = meeting.scheduledAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

      for (const number of whatsappNumbers) {
        const result = await sendMeetingReminderWhatsApp({
          to: number,
          dateLabel,
          timeLabel,
          fallbackBody,
        });
        if (result.sent) whatsappSent += 1;
      }
    }

    await prisma.meeting.update({ where: { id: meeting.id }, data: { reminderSentAt: new Date() } });
    meetingResults.push({ meetingId: meeting.id, emailSent: emailResult.sent, whatsappSent });
  }

  // ---------- 2. Auto-flag overdue invoices ----------
  const overdueUpdate = await prisma.invoice.updateMany({
    where: {
      status: { in: ['PENDING', 'PARTIAL'] },
      dueDate: { lt: now },
    },
    data: { status: 'OVERDUE' },
  });

  // ---------- 3. Payment reminders ----------
  const reminderWindowEnd = new Date(now.getTime() + PAYMENT_REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const cooldownCutoff = new Date(now.getTime() - PAYMENT_REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  const invoicesDue = await prisma.invoice.findMany({
    where: {
      status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] },
      dueDate: { lte: reminderWindowEnd },
      OR: [{ reminderSentAt: null }, { reminderSentAt: { lt: cooldownCutoff } }],
    },
    include: { client: true },
  });

  const paymentResults: { invoiceId: string; emailSent: boolean; whatsappSent: boolean }[] = [];

  for (const invoice of invoicesDue) {
    if (!invoice.client.email && !invoice.client.phone) {
      paymentResults.push({ invoiceId: invoice.id, emailSent: false, whatsappSent: false });
      continue;
    }

    const amountDue = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    const isOverdue = invoice.dueDate < now;
    const invoiceUrl = `${baseUrl}/api/public/invoices/${invoice.publicToken}`;

    let emailSent = false;
    if (invoice.client.email) {
      const result = await sendPaymentReminderEmail({
        to: invoice.client.email,
        clientName: invoice.client.name,
        invoiceNo: invoice.invoiceNo,
        amountDue,
        dueDate: invoice.dueDate,
        isOverdue,
        invoiceUrl,
      });
      emailSent = result.sent;
    }

    let whatsappSent = false;
    if (invoice.client.phone && isWhatsAppConfigured()) {
      const body = [
        isOverdue ? `Payment overdue: Invoice ${invoice.invoiceNo}` : `Payment reminder: Invoice ${invoice.invoiceNo}`,
        `Amount due: Rs. ${amountDue.toLocaleString('en-IN')}`,
        `Due date: ${invoice.dueDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}`,
        `View invoice: ${invoiceUrl}`,
      ].join('\n');

      const result = await sendWhatsApp({ to: invoice.client.phone, body });
      whatsappSent = result.sent;
    }

    await prisma.invoice.update({ where: { id: invoice.id }, data: { reminderSentAt: new Date() } });
    paymentResults.push({ invoiceId: invoice.id, emailSent, whatsappSent });
  }

  // ---------- 4. Task & sub-task due-date reminders ----------
  const taskWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const dueTasks = await prisma.task.findMany({
    where: {
      reminderSentAt: null,
      status: { in: ['PENDING', 'IN_PROGRESS', 'BLOCKED'] },
      dueDate: { not: null, lte: taskWindowEnd },
    },
    include: { assignedTo: { select: { name: true, email: true, profile: { select: { phone: true } } } } },
  });

  const dueSubtasks = await prisma.subTask.findMany({
    where: {
      reminderSentAt: null,
      status: { in: ['PENDING', 'IN_PROGRESS', 'BLOCKED'] },
      dueDate: { not: null, lte: taskWindowEnd },
    },
    include: {
      task: { select: { title: true } },
      assignedTo: { select: { name: true, email: true, profile: { select: { phone: true } } } },
    },
  });

  let taskRemindersSent = 0;

  for (const task of dueTasks) {
    const dueText = task.dueDate!.toLocaleDateString('en-IN', { dateStyle: 'medium' });
    const body = `Reminder: task "${task.title}" is due ${dueText}.`;
    if (task.assignedTo.email) {
      await sendEmail({ to: task.assignedTo.email, subject: `Task due soon: ${task.title}`, text: body });
    }
    if (task.assignedTo.profile?.phone && isWhatsAppConfigured()) {
      await sendWhatsApp({ to: task.assignedTo.profile.phone, body });
    }
    await prisma.task.update({ where: { id: task.id }, data: { reminderSentAt: new Date() } });
    taskRemindersSent += 1;
  }

  for (const subtask of dueSubtasks) {
    const dueText = subtask.dueDate!.toLocaleDateString('en-IN', { dateStyle: 'medium' });
    const body = `Reminder: sub-task "${subtask.title}" (under "${subtask.task.title}") is due ${dueText}.`;
    if (subtask.assignedTo.email) {
      await sendEmail({ to: subtask.assignedTo.email, subject: `Sub-task due soon: ${subtask.title}`, text: body });
    }
    if (subtask.assignedTo.profile?.phone && isWhatsAppConfigured()) {
      await sendWhatsApp({ to: subtask.assignedTo.profile.phone, body });
    }
    await prisma.subTask.update({ where: { id: subtask.id }, data: { reminderSentAt: new Date() } });
    taskRemindersSent += 1;
  }

  return NextResponse.json({
    meetingsChecked: meetings.length,
    meetingResults,
    invoicesFlaggedOverdue: overdueUpdate.count,
    paymentsChecked: invoicesDue.length,
    paymentResults,
    tasksAndSubtasksReminded: taskRemindersSent,
    whatsappConfigured: isWhatsAppConfigured(),
  });
}
