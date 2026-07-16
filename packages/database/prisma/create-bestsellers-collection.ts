// Create bestsellers collection in the database
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();

  try {
    // Check if collection exists
    const existing = await prisma.collection.findUnique({
      where: { slug: 'bestsellers' },
    });

    if (existing) {
      console.log('Collection already exists:', existing.id);
    } else {
      // Create the collection
      const collection = await prisma.collection.create({
        data: {
          name: 'Bestsellers',
          slug: 'bestsellers',
          description: 'Our most-loved styles.',
          type: 'EDIT',  // Manual curation
        },
      });
      console.log('Created collection:', collection.id);
    }

    // Get active products to add to the collection
    const products = await prisma.product.findMany({
      where: { isActive: true, deletedAt: null },
      take: 12,
      select: { id: true },
    });

    console.log('Found', products.length, 'active products');

    // Clear and add products to collection
    await prisma.collectionProduct.deleteMany({
      where: { collection: { slug: 'bestsellers' } },
    });

    for (let i = 0; i < products.length; i++) {
      await prisma.collectionProduct.create({
        data: {
          collection: { connect: { slug: 'bestsellers' } },
          product: { connect: { id: products[i].id } },
          position: i,
        },
      });
    }

    console.log('Added', products.length, 'products to bestsellers collection');
    console.log('Done!');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();