'use client';

import { useState, useMemo, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { calculateGst, formatInr } from '@/lib/gst';

interface ClientOption {
  id: string;
  name: string;
}

export default function InvoiceForm({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [gstRate, setGstRate] = useState('18');
  const [dueDate, setDueDate] = useState('');
  const [interState, setInterState] = useState(false);
  const [sacCode, setSacCode] = useState('998314');
  const [natureOfSupply, setNatureOfSupply] = useState<'B2B' | 'B2C'>('B2B');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const preview = useMemo(() => {
    const amt = parseFloat(amount);
    const rate = parseFloat(gstRate);
    if (!amt || Number.isNaN(amt) || Number.isNaN(rate)) return null;
    return calculateGst(amt, rate, interState);
  }, [amount, gstRate, interState]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId) {
      setError('Select a client first.');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        description: description || null,
        amount: parseFloat(amount),
        gstRate: parseFloat(gstRate),
        dueDate,
        interState,
        sacCode,
        natureOfSupply,
        placeOfSupply: placeOfSupply || null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.formErrors?.join(', ') || body.error || 'Failed to create invoice');
      return;
    }

    setDescription('');
    setAmount('');
    setDueDate('');
    setPlaceOfSupply('');
    setOpen(false);
    router.refresh();
  }

  if (clients.length === 0) {
    return (
      <p className="rounded-md bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        Add a client before raising an invoice.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        + New invoice
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2">
      <select
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <input
        type="date"
        required
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <input
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="col-span-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <input
        type="number"
        step="0.01"
        min="0"
        required
        placeholder="Amount (excl. GST)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <input
        type="number"
        step="0.01"
        min="0"
        max="100"
        required
        placeholder="GST rate %"
        value={gstRate}
        onChange={(e) => setGstRate(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <label className="col-span-full flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={interState}
          onChange={(e) => setInterState(e.target.checked)}
        />
        Inter-state supply (charge IGST instead of CGST + SGST)
      </label>

      <input
        placeholder="SAC code"
        value={sacCode}
        onChange={(e) => setSacCode(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <select
        value={natureOfSupply}
        onChange={(e) => setNatureOfSupply(e.target.value as 'B2B' | 'B2C')}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="B2B">B2B</option>
        <option value="B2C">B2C</option>
      </select>

      <input
        placeholder="Place of supply (e.g. Uttar Pradesh)"
        value={placeOfSupply}
        onChange={(e) => setPlaceOfSupply(e.target.value)}
        className="col-span-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      {preview && (
        <div className="col-span-full rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <div>GST amount: {formatInr(preview.gstAmount)}</div>
          {interState ? (
            <div>IGST: {formatInr(preview.igst)}</div>
          ) : (
            <div>
              CGST: {formatInr(preview.cgst)} · SGST: {formatInr(preview.sgst)}
            </div>
          )}
          <div className="font-medium text-gray-900">Total: {formatInr(preview.totalAmount)}</div>
        </div>
      )}

      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}

      <div className="col-span-full flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Save invoice'}
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
