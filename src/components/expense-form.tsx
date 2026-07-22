'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const CATEGORIES = [
  'SALARY',
  'RENT',
  'UTILITIES',
  'SOFTWARE',
  'MARKETING',
  'TRAVEL',
  'OFFICE_SUPPLIES',
  'PROFESSIONAL_FEES',
  'OTHER',
];

export default function ExpenseForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        category,
        amount: parseFloat(amount),
        expenseDate,
        notes: notes || null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.formErrors?.join(', ') || body.error || 'Failed to add expense');
      return;
    }

    setTitle('');
    setAmount('');
    setExpenseDate('');
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
        + Log expense
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
        placeholder="Expense title (e.g. Office rent — July)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="col-span-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c.replace('_', ' ')}
          </option>
        ))}
      </select>

      <input
        type="date"
        required
        value={expenseDate}
        onChange={(e) => setExpenseDate(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <input
        type="number"
        step="0.01"
        min="0"
        required
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
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
          {loading ? 'Saving…' : 'Save expense'}
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
