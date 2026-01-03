import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Updating admin password...');
  
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.update({
    where: { email: 'admin@lifeset.com' },
    data: {
      password: hashedPassword,
      isActive: true,
      isVerified: true,
    },
  });
  
  console.log('✅ Admin password updated successfully!');
  console.log(`   Email: ${admin.email}`);
  console.log(`   User Type: ${admin.userType}`);
  console.log(`   Active: ${admin.isActive}`);
  console.log(`   Verified: ${admin.isVerified}`);
}

main()
  .catch((e) => {
    console.error('❌ Error updating admin password:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
