'use client';

import { useState, FormEvent } from 'react';

interface RecipientOption {
  id: string;
  name: string;
  email: string;
}

export default function SendEmailForm({ recipients }: { recipients: RecipientOption[] }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, message }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.formErrors?.join(', ') || body.error || 'Failed to send email');
      return;
    }

    setSubject('');
    setMessage('');
    setSuccess(true);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        + Send email
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="flex gap-2">
        <input
          required
          type="email"
          list="recipient-emails"
          placeholder="Recipient email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <datalist id="recipient-emails">
          {recipients.map((r) => (
            <option key={r.id} value={r.email}>
              {r.name}
            </option>
          ))}
        </datalist>
      </div>

      <input
        required
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <textarea
        required
        placeholder="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Email sent.</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Sending…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </form>
  );
}
