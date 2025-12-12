import { PrismaClient, BadgeTier } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Hash password for admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@lifeset.com' },
    update: {},
    create: {
      email: 'admin@lifeset.com',
      password: hashedPassword,
      userType: 'ADMIN',
      isActive: true,
      isVerified: true,
      adminProfile: {
        create: {
          role: 'SUPER_ADMIN',
          permissions: {
            resources: ['*'],
            actions: ['*'],
          },
        },
      },
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Create sample badges
  const badges = [
    {
      name: 'First Steps',
      description: 'Complete your profile',
      tier: BadgeTier.BRONZE,
      icon: '🎯',
      criteria: { score: 100 },
    },
    {
      name: 'Rising Star',
      description: 'Score 500 points',
      tier: BadgeTier.SILVER,
      icon: '⭐',
      criteria: { score: 500 },
    },
    {
      name: 'Champion',
      description: 'Score 2000 points',
      tier: BadgeTier.GOLD,
      icon: '🏆',
      criteria: { score: 2000 },
    },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { id: badge.name }, // Use a temporary approach
      update: {},
      create: badge,
    }).catch(async () => {
      // If upsert fails, try create
      await prisma.badge.create({ data: badge });
    });
  }

  console.log('✅ Seed data created successfully');
  console.log('\n📋 Admin Credentials:');
  console.log('   Email: admin@lifeset.com');
  console.log('   Password: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
