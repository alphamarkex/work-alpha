'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import clsx from 'clsx';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leads', label: 'Leads' },
  { href: '/clients', label: 'Clients' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/meetings', label: 'Meetings' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/tickets', label: 'Tickets' },
  { href: '/holidays', label: 'Holidays' },
  { href: '/leaves', label: 'Leave' },
  { href: '/employees', label: 'Employees' },
  { href: '/profile', label: 'Profile' },
];

const founderOnlyLinks = [{ href: '/finances', label: 'Finances' }];
const managementLinks = [{ href: '/attendance', label: 'Attendance' }];

export default function NavBar({
  name,
  role,
}: {
  name: string;
  role: string;
}) {
  const pathname = usePathname();
  let visibleLinks = links;
  if (role === 'FOUNDER') visibleLinks = [...links, ...managementLinks, ...founderOnlyLinks];
  else if (role === 'MANAGER') visibleLinks = [...links, ...managementLinks];

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <span className="text-lg font-semibold text-brand-700">Workspace</span>
          <nav className="flex gap-1">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname?.startsWith(link.href)
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <div className="font-medium text-gray-900">{name}</div>
            <div className="text-xs uppercase tracking-wide text-gray-500">{role}</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
