/**
 * Fix bestsellers collection by:
 * 1. Changing type from AUTO to EDIT
 * 2. Adding top products by order count as bestsellers
 */

import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  try {
    // Find the bestsellers collection
    const collection = await prisma.collection.findUnique({
      where: { slug: 'bestsellers' },
    });

    if (!collection) {
      console.log('Bestsellers collection not found');
      return;
    }

    console.log('Current collection:', { id: collection.id, type: collection.type });

    // Get top 12 products by order count
    const topProducts = await prisma.$queryRaw<{ productId: string; orderCount: bigint }[]>`
      SELECT p.id as "productId", COUNT(o.id) as "orderCount"
      FROM "Product" p
      LEFT JOIN "OrderItem" oi ON p.id = oi."productId"
      LEFT JOIN "Order" o ON oi."orderId" = o.id AND o.status IN ('DELIVERED', 'SHIPPED', 'CONFIRMED')
      WHERE p."isActive" = true AND p."deletedAt" IS NULL
      GROUP BY p.id
      ORDER BY "orderCount" DESC
      LIMIT 12
    `;

    console.log('Top products found:', topProducts.length);

    if (topProducts.length === 0) {
      console.log('No products found, using featured products instead');

      // Fall back to featured products
      const featured = await prisma.product.findMany({
        where: { isFeatured: true, isActive: true, deletedAt: null },
        take: 12,
        select: { id: true },
      });

      // Clear existing products and add featured
      await prisma.collectionProduct.deleteMany({
        where: { collectionId: collection.id },
      });

      for (let i = 0; i < featured.length; i++) {
        await prisma.collectionProduct.create({
          data: {
            collectionId: collection.id,
            productId: featured[i].id,
            position: i,
          },
        });
      }

      console.log(`Added ${featured.length} featured products to bestsellers`);
    } else {
      // Clear existing products
      await prisma.collectionProduct.deleteMany({
        where: { collectionId: collection.id },
      });

      // Add top products
      for (let i = 0; i < topProducts.length; i++) {
        await prisma.collectionProduct.create({
          data: {
            collectionId: collection.id,
            productId: topProducts[i].productId,
            position: i,
          },
        });
      }

      console.log(`Added ${topProducts.length} products to bestsellers based on order count`);
    }

    // Update collection type to EDIT
    await prisma.collection.update({
      where: { id: collection.id },
      data: { type: 'EDIT' },
    });

    console.log('Updated collection type to EDIT');
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();