// Placeholder: prisma/seed.ts
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const founders = [
    { name: 'Founder One', email: 'lopasrivaastav231105@gmail.com', password: 'ChangeMe123!' },
    { name: 'Founder Two', email: 'harshilsrivastava1123@gmail.com', password: 'ChangeMe123!' },
  ];

  for (let i = 0; i < founders.length; i++) {
    const f = founders[i];
    const passwordHash = await bcrypt.hash(f.password, 10);
    const employeeId = `FND-000${i + 1}`;

    // Upsert on employeeId (stable per founder slot) rather than email, so
    // re-running this after changing an email still converges correctly
    // instead of colliding on the employeeId unique constraint.
    await prisma.user.upsert({
      where: { employeeId },
      update: {
        email: f.email,
        name: f.name,
        passwordHash,
        role: Role.FOUNDER,
        active: true,
      },
      create: {
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