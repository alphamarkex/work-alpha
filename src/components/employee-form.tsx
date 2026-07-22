'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface ManagerOption {
  id: string;
  name: string;
}

export default function EmployeeForm({
  managers,
  canAssignRoles,
}: {
  managers: ManagerOption[];
  canAssignRoles: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'EMPLOYEE' | 'MANAGER' | 'FOUNDER'>('EMPLOYEE');
  const [managerId, setManagerId] = useState('');
  const [designation, setDesignation] = useState('');
  const [salary, setSalary] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId,
        name,
        email,
        password,
        role,
        managerId: managerId || null,
        designation: designation || null,
        salary: salary ? parseFloat(salary) : null,
        joiningDate: joiningDate || null,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.formErrors?.join(', ') || body.error || 'Failed to add employee');
      return;
    }

    setEmployeeId('');
    setName('');
    setEmail('');
    setPassword('');
    setManagerId('');
    setDesignation('');
    setSalary('');
    setJoiningDate('');
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        + Add employee
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2">
      <input
        required
        placeholder="Employee ID (e.g. EMP-0012)"
        value={employeeId}
        onChange={(e) => setEmployeeId(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        required
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        type="password"
        required
        minLength={8}
        placeholder="Temporary password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      {canAssignRoles && (
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="EMPLOYEE">Employee</option>
          <option value="MANAGER">Manager</option>
          <option value="FOUNDER">Founder</option>
        </select>
      )}

      <select
        value={managerId}
        onChange={(e) => setManagerId(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">No manager</option>
        {managers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      <input
        placeholder="Designation (e.g. Senior Developer)"
        value={designation}
        onChange={(e) => setDesignation(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        type="date"
        placeholder="Joining date"
        value={joiningDate}
        onChange={(e) => setJoiningDate(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        type="number"
        step="0.01"
        min="0"
        placeholder="Monthly salary (Rs.)"
        value={salary}
        onChange={(e) => setSalary(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <p className="col-span-full text-xs text-gray-400">
        Designation, joining date, and salary are used to generate the employee's offer letter.
        Leaving them blank just means the offer letter won't be available until they're filled in.
      </p>

      {error && <p className="col-span-full text-sm text-red-600">{error}</p>}

      <div className="col-span-full flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Save employee'}
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
