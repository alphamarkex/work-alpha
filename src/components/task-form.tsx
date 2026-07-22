'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface ManagerOption {
  id: string;
  name: string;
}

export default function TaskForm({ managers }: { managers: ManagerOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedToId, setAssignedToId] = useState(managers[0]?.id ?? '');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!assignedToId) {
      setError('Select a manager first.');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description: description || null,
        assignedToId,
        dueDate: dueDate || null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.formErrors?.join(', ') || body.error || 'Failed to create task');
      return;
    }

    setTitle('');
    setDescription('');
    setDueDate('');
    setOpen(false);
    router.refresh();
  }

  if (managers.length === 0) {
    return (
      <p className="rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        Add a Manager before assigning tasks.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        + Assign task
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
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="col-span-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <select
        value={assignedToId}
        onChange={(e) => setAssignedToId(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        {managers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
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
        rows={3}
        className="col-span-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}

      <div className="col-span-full flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Assign task'}
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
