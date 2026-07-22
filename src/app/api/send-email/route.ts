import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canSendEmails } from '@/lib/permissions';
import { sendEmail } from '@/lib/email';

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  message: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!canSendEmails(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = sendEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { to, subject, message } = parsed.data;

  const result = await sendEmail({
    to,
    subject,
    text: `${message}\n\n— ${session.user.name}`,
  });

  if (!result.sent) {
    return NextResponse.json({ error: result.error ?? 'Failed to send email' }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
