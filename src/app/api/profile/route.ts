import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Base64 data URLs bloat fast — cap the raw upload around ~4MB before encoding.
const MAX_DOCUMENT_BASE64_LENGTH = 6_000_000;

const profileSchema = z.object({
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
  aadharNumber: z.string().optional().nullable(),
  idDocumentData: z
    .string()
    .max(MAX_DOCUMENT_BASE64_LENGTH, 'File is too large — please upload something under ~4MB')
    .optional()
    .nullable(),
  idDocumentName: z.string().optional().nullable(),
  idDocumentMimeType: z.string().optional().nullable(),
  bankAccountHolderName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankIfsc: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  markComplete: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Don't ship the (potentially multi-MB) document blob on every profile
  // fetch — just note whether one exists. The actual file is fetched
  // separately via /api/profile/document only when someone clicks to view it.
  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      phone: true,
      address: true,
      dateOfBirth: true,
      bio: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      aadharNumber: true,
      idDocumentName: true,
      idDocumentMimeType: true,
      bankAccountHolderName: true,
      bankAccountNumber: true,
      bankIfsc: true,
      bankName: true,
      completedAt: true,
    },
  });

  return NextResponse.json({
    profile: profile ? { ...profile, hasIdDocument: Boolean(profile.idDocumentName) } : null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  if (data.markComplete) {
    const existing = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { idDocumentName: true },
    });
    const willHaveDocument = Boolean(data.idDocumentData) || Boolean(existing?.idDocumentName);
    if (!willHaveDocument) {
      return NextResponse.json(
        { error: 'Please upload a copy of your Aadhaar card (or other ID) to finish setup.' },
        { status: 400 }
      );
    }
  }

  // Note: this route only ever touches personal fields (phone, address, DOB,
  // bio, emergency contact, Aadhaar/KYC). Role, designation, salary, and
  // joiningDate live on the User model and are never writable from here.
  const profile = await prisma.profile.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      phone: data.phone ?? null,
      address: data.address ?? null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      bio: data.bio ?? null,
      emergencyContactName: data.emergencyContactName ?? null,
      emergencyContactPhone: data.emergencyContactPhone ?? null,
      aadharNumber: data.aadharNumber ?? null,
      idDocumentData: data.idDocumentData ?? null,
      idDocumentName: data.idDocumentName ?? null,
      idDocumentMimeType: data.idDocumentMimeType ?? null,
      bankAccountHolderName: data.bankAccountHolderName ?? null,
      bankAccountNumber: data.bankAccountNumber ?? null,
      bankIfsc: data.bankIfsc ?? null,
      bankName: data.bankName ?? null,
      completedAt: data.markComplete ? new Date() : null,
    },
    update: {
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.dateOfBirth !== undefined
        ? { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null }
        : {}),
      ...(data.bio !== undefined ? { bio: data.bio } : {}),
      ...(data.emergencyContactName !== undefined
        ? { emergencyContactName: data.emergencyContactName }
        : {}),
      ...(data.emergencyContactPhone !== undefined
        ? { emergencyContactPhone: data.emergencyContactPhone }
        : {}),
      ...(data.aadharNumber !== undefined ? { aadharNumber: data.aadharNumber } : {}),
      ...(data.bankAccountHolderName !== undefined
        ? { bankAccountHolderName: data.bankAccountHolderName }
        : {}),
      ...(data.bankAccountNumber !== undefined ? { bankAccountNumber: data.bankAccountNumber } : {}),
      ...(data.bankIfsc !== undefined ? { bankIfsc: data.bankIfsc } : {}),
      ...(data.bankName !== undefined ? { bankName: data.bankName } : {}),
      // Only overwrite the stored document if a new one was actually sent —
      // this lets someone update other fields without re-uploading the file.
      ...(data.idDocumentData
        ? {
            idDocumentData: data.idDocumentData,
            idDocumentName: data.idDocumentName ?? null,
            idDocumentMimeType: data.idDocumentMimeType ?? null,
          }
        : {}),
      ...(data.markComplete ? { completedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({
    profile: { ...profile, idDocumentData: undefined, hasIdDocument: Boolean(profile.idDocumentName) },
  });
}
