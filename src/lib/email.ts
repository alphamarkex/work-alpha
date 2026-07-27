// Central place for all outbound email. Reuses the same Resend account
// already configured for meeting reminders (see api/cron/reminders).

import { Resend } from 'resend';

const FROM_ADDRESS = 'Workspace <team@alphamarkex.com>';

function getClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  text: string;
}

export interface SendEmailResult {
  sent: boolean;
  error?: string;
}

/** Low-level helper — sends a plain-text email via Resend. Never throws. */
export async function sendEmail({ to, subject, text }: SendEmailInput): Promise<SendEmailResult> {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) {
    return { sent: false, error: 'No recipient email' };
  }

  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'your-resend-api-key') {
    console.error('[email] RESEND_API_KEY is missing or still the placeholder value — email not sent.');
    return { sent: false, error: 'Email is not configured (missing RESEND_API_KEY)' };
  }

  try {
    const resend = getClient();
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: recipients,
      subject,
      text,
    });

    // The Resend SDK does NOT throw on API-level errors (bad key, unverified
    // domain, etc.) — it resolves with { data, error }. Missing this check
    // meant failed sends were silently treated as successful.
    if (result.error) {
      console.error('[email] Resend rejected the send:', result.error);
      return { sent: false, error: result.error.message ?? 'Resend rejected the send' };
    }

    return { sent: true };
  } catch (err) {
    console.error('[email] Unexpected error sending email:', err);
    return { sent: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/** Sends a password reset link. Link expires in 1 hour (enforced server-side). */
export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  const { to, name, resetUrl } = params;
  return sendEmail({
    to,
    subject: 'Reset your workspace password',
    text: [
      `Hi ${name},`,
      ``,
      `We received a request to reset your password. Click the link below to choose a new one:`,
      ``,
      resetUrl,
      ``,
      `This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't be changed.`,
    ].join('\n'),
  });
}
export async function sendTaskAssignedEmail(params: {
  to: string;
  managerName: string;
  founderName: string;
  taskTitle: string;
  taskDescription?: string | null;
  dueDate?: Date | null;
}) {
  const { to, managerName, founderName, taskTitle, taskDescription, dueDate } = params;
  return sendEmail({
    to,
    subject: `New task assigned to you: ${taskTitle}`,
    text: [
      `Hi ${managerName},`,
      ``,
      `${founderName} has assigned you a new task.`,
      ``,
      `Title: ${taskTitle}`,
      taskDescription ? `Description: ${taskDescription}` : null,
      dueDate ? `Due: ${dueDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}` : null,
      ``,
      `Log in to your workspace to view details and break it into sub-tasks for your team.`,
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

/** Notifies an Employee that their Manager has handed them a new sub-task. */
export async function sendSubtaskAssignedEmail(params: {
  to: string;
  employeeName: string;
  managerName: string;
  parentTaskTitle: string;
  subtaskTitle: string;
  subtaskDescription?: string | null;
  dueDate?: Date | null;
}) {
  const {
    to,
    employeeName,
    managerName,
    parentTaskTitle,
    subtaskTitle,
    subtaskDescription,
    dueDate,
  } = params;
  return sendEmail({
    to,
    subject: `New sub-task assigned to you: ${subtaskTitle}`,
    text: [
      `Hi ${employeeName},`,
      ``,
      `${managerName} has assigned you a new sub-task under "${parentTaskTitle}".`,
      ``,
      `Title: ${subtaskTitle}`,
      subtaskDescription ? `Description: ${subtaskDescription}` : null,
      dueDate ? `Due: ${dueDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}` : null,
      ``,
      `Log in to your workspace to view details.`,
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

/** Meeting reminder — sent ahead of a scheduled meeting, with the join link if one was set. */
export async function sendMeetingReminderEmail(params: {
  to: string[];
  title: string;
  whenText: string;
  clientName?: string | null;
  notes?: string | null;
  meetingLink?: string | null;
}) {
  const { to, title, whenText, clientName, notes, meetingLink } = params;
  return sendEmail({
    to,
    subject: `Reminder: ${title} — ${whenText}`,
    text: [
      `This is a reminder for an upcoming meeting.`,
      ``,
      `Title: ${title}`,
      `When: ${whenText}`,
      clientName ? `Client: ${clientName}` : null,
      meetingLink ? `Join link: ${meetingLink}` : null,
      notes ? `Notes: ${notes}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

/** Payment reminder — sent to a client for an invoice that's due soon or overdue. */
export async function sendPaymentReminderEmail(params: {
  to: string;
  clientName: string;
  invoiceNo: string;
  amountDue: number;
  dueDate: Date;
  isOverdue: boolean;
  invoiceUrl: string;
}) {
  const { to, clientName, invoiceNo, amountDue, dueDate, isOverdue, invoiceUrl } = params;
  return sendEmail({
    to,
    subject: isOverdue
      ? `Overdue: Invoice ${invoiceNo} — payment pending`
      : `Reminder: Invoice ${invoiceNo} due ${dueDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}`,
    text: [
      `Hi ${clientName},`,
      ``,
      isOverdue
        ? `This is a reminder that invoice ${invoiceNo} is now overdue.`
        : `This is a friendly reminder that invoice ${invoiceNo} is due soon.`,
      ``,
      `Amount due: Rs. ${amountDue.toLocaleString('en-IN')}`,
      `Due date: ${dueDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}`,
      ``,
      `View / download the invoice: ${invoiceUrl}`,
      ``,
      `If you've already paid, please disregard this message.`,
    ].join('\n'),
  });
}

/** Welcome email sent to a newly created employee with their login credentials. */
export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}) {
  const { to, name, email, temporaryPassword, loginUrl } = params;
  return sendEmail({
    to,
    subject: 'Your workspace account is ready',
    text: [
      `Hi ${name},`,
      ``,
      `An account has been created for you. Here are your login details:`,
      ``,
      `Login page: ${loginUrl}`,
      `Email: ${email}`,
      `Temporary password: ${temporaryPassword}`,
      ``,
      `You'll be asked to set a new password and fill in a short profile the first time you sign in.`,
    ].join('\n'),
  });
}

/** Sent when a client gets portal access — separate copy since they don't go through the staff profile/onboarding flow. */
export async function sendClientPortalWelcomeEmail(params: {
  to: string;
  name: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}) {
  const { to, name, email, temporaryPassword, loginUrl } = params;
  return sendEmail({
    to,
    subject: 'Your client portal access is ready',
    text: [
      `Hi ${name},`,
      ``,
      `You now have access to your client portal, where you can track the work being done for you and view your documents.`,
      ``,
      `Login page: ${loginUrl}`,
      `Email: ${email}`,
      `Temporary password: ${temporaryPassword}`,
      ``,
      `You'll be asked to set a new password the first time you sign in.`,
    ].join('\n'),
  });
}

/** Sent when a Founder resets someone's password on their behalf. */
export async function sendPasswordResetByAdminEmail(params: {
  to: string;
  name: string;
  temporaryPassword: string;
  loginUrl: string;
}) {
  const { to, name, temporaryPassword, loginUrl } = params;
  return sendEmail({
    to,
    subject: 'Your workspace password has been reset',
    text: [
      `Hi ${name},`,
      ``,
      `An admin has reset your password. Here's your new temporary password:`,
      ``,
      `Login page: ${loginUrl}`,
      `Temporary password: ${temporaryPassword}`,
      ``,
      `You'll be asked to set a new password the next time you sign in.`,
    ].join('\n'),
  });
}
