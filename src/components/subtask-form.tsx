'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface EmployeeOption {
  id: string;
  name: string;
}

export default function SubtaskForm({
  taskId,
  employees,
}: {
  taskId: string;
  employees: EmployeeOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToId, setAssignedToId] = useState(employees[0]?.id ?? '');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!assignedToId) {
      setError('Select an employee first.');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/subtasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        title,
        description: description || null,
        assignedToId,
        dueDate: dueDate || null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.formErrors?.join(', ') || body.error || 'Failed to create sub-task');
      return;
    }

    setTitle('');
    setDescription('');
    setDueDate('');
    setOpen(false);
    router.refresh();
  }

  if (employees.length === 0) {
    return (
      <p className="mt-2 rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
        No active teammates to delegate to yet.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
      >
        + Split into sub-task
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2"
    >
      <input
        required
        placeholder="Sub-task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="col-span-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <select
        value={assignedToId}
        onChange={(e) => setAssignedToId(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="col-span-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}

      <div className="col-span-full flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Assign sub-task'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
