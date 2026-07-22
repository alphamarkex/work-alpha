'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface ManagerOption {
  id: string;
  name: string;
}

interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  role: 'FOUNDER' | 'MANAGER' | 'EMPLOYEE';
  managerId: string | null;
  designation: string | null;
  salary: number | null;
  joiningDate: string | null; // yyyy-mm-dd
  active: boolean;
}

export default function EmployeeRowActions({
  employee,
  managers,
}: {
  employee: EmployeeRow;
  managers: ManagerOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);

  const [name, setName] = useState(employee.name);
  const [email, setEmail] = useState(employee.email);
  const [role, setRole] = useState(employee.role);
  const [managerId, setManagerId] = useState(employee.managerId ?? '');
  const [designation, setDesignation] = useState(employee.designation ?? '');
  const [salary, setSalary] = useState(employee.salary?.toString() ?? '');
  const [joiningDate, setJoiningDate] = useState(employee.joiningDate ?? '');

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch('/api/employees', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: employee.id,
        name,
        email,
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
      setError(body.error?.formErrors?.join(', ') || body.error || 'Failed to save changes');
      return;
    }

    setEditing(false);
    router.refresh();
  }

  async function handleToggleActive() {
    setLoading(true);
    if (employee.active) {
      await fetch(`/api/employees?id=${employee.id}`, { method: 'DELETE' });
    } else {
      await fetch('/api/employees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: employee.id, active: true }),
      });
    }
    setLoading(false);
    router.refresh();
  }

  async function handleResetPassword() {
    if (!confirm(`Reset ${employee.name}'s password? A new temporary password will be emailed to them.`)) {
      return;
    }
    setLoading(true);
    setResetResult(null);
    const res = await fetch('/api/employees/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: employee.id }),
    });
    setLoading(false);
    if (res.ok) {
      const body = await res.json();
      setResetResult(body.emailSent ? 'New password emailed.' : 'Reset, but email failed to send.');
    } else {
      setResetResult('Failed to reset password.');
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="absolute z-10 mt-2 w-80 space-y-2 rounded-lg border border-gray-200 bg-white p-4 text-left shadow-lg"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          placeholder="Name"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          placeholder="Email"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as EmployeeRow['role'])}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="EMPLOYEE">EMPLOYEE</option>
          <option value="MANAGER">MANAGER</option>
          <option value="FOUNDER">FOUNDER</option>
        </select>
        <select
          value={managerId}
          onChange={(e) => setManagerId(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">No manager</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          placeholder="Designation"
        />
        <input
          type="date"
          value={joiningDate}
          onChange={(e) => setJoiningDate(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          step="0.01"
          value={salary}
          onChange={(e) => setSalary(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          placeholder="Monthly salary (Rs.)"
        />

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <button
        onClick={() => setEditing(true)}
        className="text-xs font-medium text-brand-600 hover:text-brand-700"
      >
        Edit
      </button>
      <button
        onClick={handleResetPassword}
        disabled={loading}
        className="text-xs font-medium text-gray-600 hover:text-gray-800 disabled:opacity-60"
      >
        Reset password
      </button>
      <button
        onClick={handleToggleActive}
        disabled={loading}
        className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
      >
        {employee.active ? 'Deactivate' : 'Reactivate'}
      </button>
      {resetResult && <span className="text-xs text-gray-400">{resetResult}</span>}
    </div>
  );
}
