'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LeaveRowActions({
  leaveId,
  canReview,
  isOwn,
  status,
}: {
  leaveId: string;
  canReview: boolean;
  isOwn: boolean;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);

  async function updateStatus(newStatus: 'APPROVED' | 'REJECTED' | 'CANCELLED') {
    setLoading(true);
    await fetch('/api/leaves', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leaveId, status: newStatus, reviewNote: note || null }),
    });
    setLoading(false);
    router.refresh();
  }

  if (status !== 'PENDING') return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {canReview && (
          <>
            <button
              onClick={() => updateStatus('APPROVED')}
              disabled={loading}
              className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-60"
            >
              Approve
            </button>
            <button
              onClick={() => (showNote ? updateStatus('REJECTED') : setShowNote(true))}
              disabled={loading}
              className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
            >
              Reject
            </button>
          </>
        )}
        {isOwn && (
          <button
            onClick={() => updateStatus('CANCELLED')}
            disabled={loading}
            className="text-xs font-medium text-gray-400 hover:text-gray-600 disabled:opacity-60"
          >
            Cancel
          </button>
        )}
      </div>
      {showNote && (
        <input
          autoFocus
          placeholder="Optional note, then click Reject again"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
        />
      )}
    </div>
  );
}
