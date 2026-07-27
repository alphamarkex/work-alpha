'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface DocumentItem {
  id: string;
  name: string;
  mimeType: string;
  createdAt: string;
  uploadedBy: { name: string };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export default function ClientDocumentUpload({
  clientId,
  documents,
  canManage,
}: {
  clientId: string;
  documents: DocumentItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError('That file is too large — please upload something under 4MB.');
      return;
    }

    setLoading(true);
    const data = await readFileAsDataUrl(file);
    const res = await fetch(`/api/clients/${clientId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, mimeType: file.type, data }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.formErrors?.join(', ') || body.error || 'Upload failed');
      return;
    }

    setFile(null);
    router.refresh();
  }

  async function handleDelete(docId: string) {
    if (!confirm('Delete this document?')) return;
    await fetch(`/api/clients/${clientId}/documents?docId=${docId}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <form onSubmit={handleUpload} className="flex items-center gap-2">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={loading || !file}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {documents.length === 0 ? (
        <p className="text-sm text-gray-500">No documents yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <a
                href={`/api/clients/${clientId}/documents/${doc.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-600 hover:text-brand-700"
              >
                {doc.name}
              </a>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>
                  {doc.uploadedBy.name} ·{' '}
                  {new Date(doc.createdAt).toLocaleDateString('en-IN', {
                    dateStyle: 'medium',
                    timeZone: 'Asia/Kolkata',
                  })}
                </span>
                {canManage && (
                  <button onClick={() => handleDelete(doc.id)} className="text-gray-400 hover:text-red-600">
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
