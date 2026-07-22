'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

const STATUS_OPTIONS = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST'] as Array<
  'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL_SENT' | 'WON' | 'LOST'
>;

export const statusStyles: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-700',
  CONTACTED: 'bg-blue-100 text-blue-800',
  QUALIFIED: 'bg-purple-100 text-purple-800',
  PROPOSAL_SENT: 'bg-yellow-100 text-yellow-800',
  WON: 'bg-green-100 text-green-800',
  LOST: 'bg-red-100 text-red-800',
};

export default function LeadRowActions({
  leadId,
  status,
  converted,
}: {
  leadId: string;
  status: string;
  converted: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, status: newStatus }),
    });
    setLoading(false);
    router.refresh();
  }

  async function convertToClient() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/leads/${leadId}/convert`, { method: 'POST' });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Failed to convert');
      return;
    }
    router.refresh();
  }

  async function deleteLead() {
    if (!confirm('Delete this lead?')) return;
    setLoading(true);
    await fetch(`/api/leads?id=${leadId}`, { method: 'DELETE' });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        disabled={loading || converted}
        onChange={(e) => updateStatus(e.target.value)}
        className={clsx(
          'rounded-full border-0 px-2 py-1 text-xs font-medium disabled:opacity-60',
          statusStyles[status]
        )}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt.replace('_', ' ')}
          </option>
        ))}
      </select>

      {!converted && (
        <button
          onClick={convertToClient}
          disabled={loading}
          className="rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60"
        >
          Convert to client
        </button>
      )}

      <button
        onClick={deleteLead}
        disabled={loading}
        className="text-xs font-medium text-gray-400 hover:text-red-600 disabled:opacity-60"
      >
        Delete
      </button>

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
