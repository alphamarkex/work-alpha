'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HolidayRowActions({ holidayId }: { holidayId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm('Remove this holiday?')) return;
    setLoading(true);
    await fetch(`/api/holidays?id=${holidayId}`, { method: 'DELETE' });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs font-medium text-gray-400 hover:text-red-600 disabled:opacity-60"
    >
      Remove
    </button>
  );
}
