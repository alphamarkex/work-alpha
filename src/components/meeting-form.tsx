'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface ClientOption {
  id: string;
  name: string;
}

export default function MeetingForm({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        clientId: clientId || null,
        scheduledAt,
        notes: notes || null,
        meetingLink: meetingLink || null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.formErrors?.join(', ') || body.error || 'Failed to schedule meeting');
      return;
    }

    setTitle('');
    setClientId('');
    setScheduledAt('');
    setMeetingLink('');
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
        + Schedule meeting
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2">
      <input
        required
        placeholder="Meeting title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <select
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">Team meeting (no client)</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <input
        type="datetime-local"
        required
        value={scheduledAt}
        onChange={(e) => setScheduledAt(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <input
        type="url"
        placeholder="Meeting link (Zoom / Meet / Teams — optional)"
        value={meetingLink}
        onChange={(e) => setMeetingLink(e.target.value)}
        className="col-span-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <input
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}

      <div className="col-span-full flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Save meeting'}
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
