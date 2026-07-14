import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const newPassword = process.argv[2] || 'Password123!';

  const hash = await bcrypt.hash(newPassword, 12);

  const user = await prisma.user.update({
    where: { email: 'admin@denimisia.com' },
    data: { passwordHash: hash },
  });

  console.log(`✅ Password updated for ${user.email}`);
  console.log(`   New password: ${newPassword}`);
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());