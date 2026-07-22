'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

export default function TicketResponseForm({
  ticketId,
  status,
  response,
}: {
  ticketId: string;
  status: string;
  response: string | null;
}) {
  const router = useRouter();
  const [draftResponse, setDraftResponse] = useState(response ?? '');
  const [draftStatus, setDraftStatus] = useState(status);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    await fetch('/api/tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ticketId, status: draftStatus, response: draftResponse || null }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
      <textarea
        value={draftResponse}
        onChange={(e) => setDraftResponse(e.target.value)}
        rows={2}
        placeholder="Write a response…"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <select
          value={draftStatus}
          onChange={(e) => setDraftStatus(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt.replace('_', ' ')}
            </option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={loading}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
