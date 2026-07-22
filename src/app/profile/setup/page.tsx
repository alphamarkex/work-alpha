import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ProfileForm from '@/components/profile-form';

export default async function ProfileSetupPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }
  if (session.user.mustChangePassword) {
    redirect('/change-password');
  }

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  if (profile?.completedAt) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">Welcome, {session.user.name.split(' ')[0]}</h1>
        <p className="mb-6 text-sm text-gray-500">
          Before you get started, tell us a bit about yourself. Your role and employment details
          are set by your workspace admin and aren't editable here.
        </p>
        <ProfileForm
          initial={{
            phone: profile?.phone,
            address: profile?.address,
            dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : null,
            bio: profile?.bio,
            emergencyContactName: profile?.emergencyContactName,
            emergencyContactPhone: profile?.emergencyContactPhone,
          }}
          mode="setup"
        />
      </div>
    </div>
  );
}
