'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function ClientPortalLoginForm({
  clientId,
  existingEmail,
}: {
  clientId: string;
  existingEmail: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(existingEmail ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    const res = await fetch(`/api/clients/${clientId}/portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.formErrors?.join(', ') || body.error || 'Failed to set up portal login');
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  async function handleRemove() {
    if (!confirm("Remove this client's portal access?")) return;
    await fetch(`/api/clients/${clientId}/portal`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="email"
          required
          placeholder="client@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Saving…' : existingEmail ? 'Reset access' : 'Grant portal access'}
        </button>
        {existingEmail && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs font-medium text-gray-400 hover:text-red-600"
          >
            Remove
          </button>
        )}
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && (
        <p className="text-xs text-green-600">
          Portal login ready — credentials emailed to the client.
        </p>
      )}
      {existingEmail && !success && (
        <p className="text-xs text-gray-400">
          Portal access already set up for {existingEmail}. Submitting again resets their password
          and re-sends credentials.
        </p>
      )}
    </div>
  );
}
