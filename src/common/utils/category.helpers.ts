import { PrismaService } from '../prisma/prisma.service';

/**
 * Update postCount for a category
 */
export async function updateCategoryPostCount(
  prisma: PrismaService,
  categoryId: string | null | undefined,
): Promise<void> {
  if (!categoryId) return;

  try {
    const count = await prisma.post.count({
      where: {
        categoryId,
        isActive: true,
      },
    });

    await prisma.wallCategory.update({
      where: { id: categoryId },
      data: { postCount: count },
    });
  } catch (error) {
    // Log but don't fail if category doesn't exist
    console.warn(`Failed to update postCount for category ${categoryId}:`, error);
  }
}

/**
 * Update postCount for multiple categories
 */
export async function updateCategoryPostCounts(
  prisma: PrismaService,
  categoryIds: (string | null | undefined)[],
): Promise<void> {
  const uniqueIds = [...new Set(categoryIds.filter((id): id is string => !!id))];
  
  await Promise.all(
    uniqueIds.map(id => updateCategoryPostCount(prisma, id))
  );
}


