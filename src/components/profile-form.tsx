'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface ProfileData {
  phone?: string | null;
  address?: string | null;
  dateOfBirth?: string | null; // yyyy-mm-dd
  bio?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  aadharNumber?: string | null;
  hasIdDocument?: boolean;
  idDocumentName?: string | null;
}

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export default function ProfileForm({
  initial,
  mode,
}: {
  initial: ProfileData;
  mode: 'setup' | 'edit';
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [address, setAddress] = useState(initial.address ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth ?? '');
  const [bio, setBio] = useState(initial.bio ?? '');
  const [emergencyContactName, setEmergencyContactName] = useState(
    initial.emergencyContactName ?? ''
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    initial.emergencyContactPhone ?? ''
  );
  const [aadharNumber, setAadharNumber] = useState(initial.aadharNumber ?? '');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const requireDocument = mode === 'setup' && !initial.hasIdDocument;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (requireDocument && !documentFile) {
      setError('Please upload a copy of your Aadhaar card (or other ID) to finish setup.');
      return;
    }

    if (documentFile && documentFile.size > MAX_FILE_BYTES) {
      setError('That file is too large — please upload something under 4MB.');
      return;
    }

    setLoading(true);

    let idDocumentData: string | null = null;
    if (documentFile) {
      try {
        idDocumentData = await readFileAsDataUrl(documentFile);
      } catch {
        setLoading(false);
        setError('Could not read that file — try a different one.');
        return;
      }
    }

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phone || null,
        address: address || null,
        dateOfBirth: dateOfBirth || null,
        bio: bio || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        aadharNumber: aadharNumber || null,
        idDocumentData,
        idDocumentName: documentFile?.name ?? null,
        idDocumentMimeType: documentFile?.type ?? null,
        markComplete: mode === 'setup',
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.formErrors?.join(', ') || body.error || 'Failed to save profile');
      return;
    }

    if (mode === 'setup') {
      router.push('/dashboard');
      router.refresh();
    } else {
      setSuccess(true);
      setDocumentFile(null);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="+91 …"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Date of birth</label>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">About you</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="A short bio — background, interests, anything you'd like your team to know."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Emergency contact name
          </label>
          <input
            value={emergencyContactName}
            onChange={(e) => setEmergencyContactName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Emergency contact phone
          </label>
          <input
            value={emergencyContactPhone}
            onChange={(e) => setEmergencyContactPhone(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Identity verification</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Aadhaar number</label>
            <input
              value={aadharNumber}
              onChange={(e) => setAadharNumber(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="XXXX XXXX XXXX"
              maxLength={14}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              ID document (Aadhaar card, image or PDF)
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
            {initial.hasIdDocument && !documentFile && (
              <p className="mt-1 text-xs text-gray-500">
                A document is already on file{initial.idDocumentName ? ` (${initial.idDocumentName})` : ''}.
                Upload a new one only if you want to replace it.
              </p>
            )}
          </div>
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {success && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Saved.</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? 'Saving…' : mode === 'setup' ? 'Finish setup' : 'Save changes'}
      </button>
    </form>
  );
}
