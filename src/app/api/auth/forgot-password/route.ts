import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success, whether or not the account exists — this avoids
  // leaking which emails are registered in the workspace.
  if (!user || !user.active) {
    return NextResponse.json({ success: true });
  }

  const token = randomBytes(32).toString('hex');

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  const result = await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });
  if (!result.sent) {
    // Logged, not returned to the client — see the "Always return success"
    // note above. Check this log if a reset email isn't arriving.
    console.error(`[forgot-password] Failed to send reset email to ${user.email}:`, result.error);
  }

  return NextResponse.json({ success: true });
}
