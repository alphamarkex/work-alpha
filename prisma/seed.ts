// Seeds the two original founder accounts for your existing company
// (AlphaMarkex), which the multi-tenant migration attached to a default
// Organization row with a fixed id so this script keeps working afterward.
// New companies should use the /signup page instead — this script is only
// for your original workspace.
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_ORGANIZATION_ID = 'org_default_alphamarkex';

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: DEFAULT_ORGANIZATION_ID },
    update: {},
    create: {
      id: DEFAULT_ORGANIZATION_ID,
      name: 'ALPHAMARKEX LLP',
      gstin: '09ACMFA9676Q1Z5',
      address: 'Oro Dental Clinic, Mahuwaria, Mirzapur, Uttar Pradesh',
      email: 'alphamarkex@gmail.com',
    },
  });

  const founders = [
    { name: 'Founder One', email: 'lopasrivaastav112305@gmail.com', password: 'Lopa@123' },
    { name: 'Founder Two', email: 'harshilsrivastava1123@gmail.com', password: 'ChangeMe123!' },
  ];

  for (let i = 0; i < founders.length; i++) {
    const f = founders[i];
    const passwordHash = await bcrypt.hash(f.password, 10);
    const employeeId = `FND-000${i + 1}`;

    // Upsert on (organizationId, employeeId) — stable per founder slot — so
    // re-running this after changing an email still converges correctly
    // instead of colliding on the unique constraint.
    await prisma.user.upsert({
      where: { organizationId_employeeId: { organizationId: organization.id, employeeId } },
      update: {
        email: f.email,
        name: f.name,
        passwordHash,
        role: Role.FOUNDER,
        active: true,
      },
      create: {
        organizationId: organization.id,
        employeeId,
        name: f.name,
        email: f.email,
        passwordHash,
        role: Role.FOUNDER,
      },
    });
    console.log(`Upserted founder: ${f.email} (password: ${f.password} — change after first login)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
