import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatInr } from '@/lib/gst';
import ProfileForm from '@/components/profile-form';

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;

  const [profile, fullUser] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id } }),
    prisma.user.findUnique({
      where: { id: user.id },
      include: { manager: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Your profile</h1>
        <p className="text-sm text-gray-500">
          Personal details are yours to update. Role and employment info are set by your admin.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Employment details
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-gray-400">Employee ID</dt>
            <dd className="text-sm text-gray-900">{fullUser?.employeeId}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Role</dt>
            <dd className="text-sm text-gray-900">{fullUser?.role}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Designation</dt>
            <dd className="text-sm text-gray-900">{fullUser?.designation ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Reports to</dt>
            <dd className="text-sm text-gray-900">{fullUser?.manager?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Joining date</dt>
            <dd className="text-sm text-gray-900">
              {fullUser?.joiningDate
                ? fullUser.joiningDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })
                : '—'}
            </dd>
          </div>
          {user.role === 'FOUNDER' && (
            <div>
              <dt className="text-xs text-gray-400">Salary</dt>
              <dd className="text-sm text-gray-900">
                {fullUser?.salary ? formatInr(Number(fullUser.salary)) : '—'}
              </dd>
            </div>
          )}
        </dl>

        {fullUser?.designation && fullUser?.joiningDate && (
          <a
            href={`/api/offer-letter/${user.id}`}
            className="mt-4 inline-block rounded-md border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
          >
            Download offer letter (PDF)
          </a>
        )}

        {fullUser?.designation && fullUser?.salary && (
          <a
            href={`/api/salary-slip/${user.id}`}
            className="mt-4 ml-2 inline-block rounded-md border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
          >
            Download this month's salary slip (PDF)
          </a>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Personal details
        </h2>
        <ProfileForm
          initial={{
            phone: profile?.phone,
            address: profile?.address,
            dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : null,
            bio: profile?.bio,
            emergencyContactName: profile?.emergencyContactName,
            emergencyContactPhone: profile?.emergencyContactPhone,
            aadharNumber: profile?.aadharNumber,
            hasIdDocument: Boolean(profile?.idDocumentName),
            idDocumentName: profile?.idDocumentName,
          }}
          mode="edit"
        />
        {profile?.idDocumentName && (
          <a
            href={`/api/profile/document?userId=${user.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            View uploaded ID document
          </a>
        )}
      </div>
    </div>
  );
}
