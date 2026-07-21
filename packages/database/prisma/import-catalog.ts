/**
 * Product Import Script
 *
 * Usage:
 * npx tsx packages/database/prisma/import-catalog.ts
 *
 * This script imports products from data/catalog/output/products.json into the database.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Map hero_category to category names (adjust as needed)
const CATEGORY_MAP: Record<string, string> = {
  'wide-leg': 'Wide-Leg',
  'baggy': 'Baggy Fit',
  'designed': 'Designed',
  'boyfriend': 'Boyfriend',
  'straight': 'Straight Leg',
  'cargo': 'Cargo',
  'flared': 'Flared',
  'bootcut': 'Bootcut',
  'high-waisted': 'High-Waisted',
  'distressed': 'Distressed',
  'barrel': 'Barrel Fit',
};

interface ProductData {
  model: string;
  slug: string;
  title: string;
  fit?: string;
  waist?: string;
  stretch?: string;
  fabric?: string;
  hero_category: string;
  tags: string[];
  variants: VariantData[];
}
}

interface VariantData {
  serial: number;
  wash_code: string;
  wash_name: string;
  wash_hex: string;
  sku_prefix: string;
  price_bdt: number;
  special_price_bdt?: number;
  status: string;
  source_image: string;
  name_suffix: string;
  sizes: Record<string, number>;
  total_stock: number;
}

async function getOrCreateCategory(name: string): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } }
  });

  if (existing) {
    return existing.id;
  }

  const category = await prisma.category.create({
    data: {
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: `${name} category`,
    }
  });

  console.log(`Created category: ${name}`);
  return category.id;
}

async function importProducts() {
  const dataPath = path.join(__dirname, '../../data/catalog/output/products.json');

  if (!fs.existsSync(dataPath)) {
    console.error('Products file not found:', dataPath);
    return;
  }

  const products: ProductData[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`Found ${products.length} products to import`);

  // Get or create default category
  const defaultCategoryId = await getOrCreateCategory('Jeans');

  let imported = 0;
  let skipped = 0;

  for (const product of products) {
    try {
      // Check if product already exists
      const existing = await prisma.product.findUnique({
        where: { slug: product.slug }
      });

      if (existing) {
        console.log(`Skipping existing product: ${product.slug}`);
        skipped++;
        continue;
      }

      // Get category ID
      const categoryName = CATEGORY_MAP[product.hero_category] || 'Jeans';
      const categoryId = await getOrCreateCategory(categoryName);

      // Determine price (use special_price if available)
      const basePrice = product.variants[0]?.special_price_bdt || product.variants[0]?.price_bdt || 0;
      const compareAtPrice = product.variants[0]?.special_price_bdt ? product.variants[0]?.price_bdt : null;

      // Create product
      const createdProduct = await prisma.product.create({
        data: {
          name: product.title,
          slug: product.slug,
          description: `${product.title} - ${product.fabric || ''}`.trim(),
          price: basePrice,
          compareAtPrice: compareAtPrice,
          images: product.variants.map(v => v.source_image).filter(Boolean),
          tags: product.tags,
          type: 'DENIM' as any,
          isActive: true,
          categoryId: categoryId || defaultCategoryId,
        }
      });

      // Create variants
      for (const variant of product.variants) {
        const stock = Object.values(variant.sizes).reduce((a, b) => a + b, 0);

        if (stock > 0) {
          await prisma.productVariant.create({
            data: {
              productId: createdProduct.id,
              sku: `${variant.sku_prefix}-${Object.keys(variant.sizes)[0]}`,
              size: Object.keys(variant.sizes)[0] || 'M',
              color: variant.wash_name,
              colorHex: variant.wash_hex,
              price: variant.special_price_bdt || variant.price_bdt,
              stock: stock,
              images: variant.source_image ? [variant.source_image] : [],
              isActive: variant.status === 'enabled',
            }
          });
        }
      }

      imported++;
      console.log(`Imported: ${product.title} (${product.variants.length} variants)`);

    } catch (error) {
      console.error(`Error importing ${product.title}:`, error);
    }
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Imported: ${imported} products`);
  console.log(`Skipped (already exists): ${skipped} products`);
}

importProducts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
