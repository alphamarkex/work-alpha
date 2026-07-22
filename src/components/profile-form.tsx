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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

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
