import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const name = process.env.ADMIN_NAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !name || !password || password.length < 12) {
    throw new Error(
      'Set ADMIN_EMAIL, ADMIN_NAME, and an ADMIN_PASSWORD with at least 12 characters before seeding.',
    );
  }
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash: await argon2.hash(password), role: Role.ADMIN },
  });
  await prisma.business.upsert({
    where: { id: 'default-business-migration' },
    update: {},
    create: { id: 'default-business-migration', name: 'Default Business' },
  });
  await prisma.businessMember.upsert({
    where: { businessId_userId: { businessId: 'default-business-migration', userId: user.id } },
    update: {},
    create: { businessId: 'default-business-migration', userId: user.id, role: 'OWNER' },
  });
  console.log(`Administrator account ready for ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
