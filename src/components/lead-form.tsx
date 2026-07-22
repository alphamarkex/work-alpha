'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface AssigneeOption {
  id: string;
  name: string;
}

export default function LeadForm({ assignees }: { assignees: AssigneeOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        company: company || null,
        email: email || null,
        phone: phone || null,
        source: source || null,
        notes: notes || null,
        assignedToId: assignedToId || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.formErrors?.join(', ') || body.error || 'Failed to add lead');
      return;
    }

    setName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setSource('');
    setNotes('');
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        + Add lead
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2"
    >
      <input
        required
        placeholder="Contact name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        placeholder="Company (optional)"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        type="email"
        placeholder="Email (optional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        placeholder="Phone (optional)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        placeholder="Source (e.g. referral, website, cold call)"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      {assignees.length > 0 && (
        <select
          value={assignedToId}
          onChange={(e) => setAssignedToId(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Assign to me</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}

      <textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="col-span-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}

      <div className="col-span-full flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Add lead'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
