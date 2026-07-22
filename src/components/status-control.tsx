'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

const STATUS_OPTIONS = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'] as const;

export const statusStyles: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  BLOCKED: 'bg-red-100 text-red-800',
};

export default function StatusControl({
  kind,
  id,
  status,
  disabled = false,
}: {
  kind: 'task' | 'subtask';
  id: string;
  status: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleChange(newStatus: string) {
    setLoading(true);
    const endpoint = kind === 'task' ? '/api/tasks' : '/api/subtasks';
    await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    });
    setLoading(false);
    router.refresh();
  }

  if (disabled) {
    return (
      <span className={clsx('rounded-full px-2 py-1 text-xs font-medium', statusStyles[status])}>
        {status.replace('_', ' ')}
      </span>
    );
  }

  return (
    <select
      value={status}
      disabled={loading}
      onChange={(e) => handleChange(e.target.value)}
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
  );
}
