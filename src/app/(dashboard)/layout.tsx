import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import NavBar from '@/components/nav-bar';
import AttendanceTracker from '@/components/attendance-tracker';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.mustChangePassword) {
    redirect('/change-password');
  }

  // Client-portal accounts never see the staff dashboard, the internal
  // profile/KYC onboarding, or the attendance tracker — they get their own
  // minimal layout under /client-portal instead.
  if (session.user.role === 'CLIENT') {
    redirect('/client-portal');
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  if (!profile?.completedAt) {
    redirect('/profile/setup');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar name={session.user.name} role={session.user.role} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <AttendanceTracker />
        {children}
      </main>
    </div>
  );
}
