import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface AutoRules {
  includeCategoryIds?: string[];
  includeTags?: string[];
  includeIfBestseller?: boolean;
  includeIfNewArrival?: boolean;
  newArrivalDays?: number;
  onSaleOnly?: boolean;
  inStockOnly?: boolean;
  excludeProductIds?: string[];
  maxProducts?: number;
}

interface CollectionLike {
  autoRules: AutoRules | Prisma.JsonValue | null;
}

@Injectable()
export class CollectionsAutoService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(collection: CollectionLike) {
    const rules: AutoRules =
      (collection.autoRules as AutoRules | null) ?? ({} as AutoRules);

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      deletedAt: null,
    };

    if (rules.includeCategoryIds?.length) {
      where.categoryId = { in: rules.includeCategoryIds };
    }
    if (rules.includeTags?.length) {
      where.tags = { hasSome: rules.includeTags };
    }
    if (rules.includeIfBestseller) {
      where.isTrending = true;
    }
    if (rules.includeIfNewArrival) {
      const days = rules.newArrivalDays ?? 14;
      where.createdAt = { gte: new Date(Date.now() - days * 86_400_000) };
    }
    if (rules.onSaleOnly) {
      where.compareAtPrice = { not: null };
    }
    if (rules.excludeProductIds?.length) {
      where.id = { notIn: rules.excludeProductIds };
    }
    if (rules.inStockOnly) {
      where.variants = { some: { stock: { gt: 0 } } };
    }

    // If includeIfBestseller but no trending products, fallback to popular products
    // by looking at order counts, then by recently created
    if (rules.includeIfBestseller) {
      const trendingProducts = await this.prisma.product.findMany({
        where,
        include: { variants: true, category: true },
        orderBy: { createdAt: 'desc' },
        take: rules.maxProducts ?? 24,
      });

      // If no trending products found, get products by recent orders or just recent products
      if (trendingProducts.length === 0) {
        const fallbackProducts = await this.prisma.product.findMany({
          where: { isActive: true, deletedAt: null },
          include: { variants: true, category: true },
          orderBy: { createdAt: 'desc' },
          take: rules.maxProducts ?? 24,
        });
        return fallbackProducts.map((product, position) => ({
          collectionId: '__auto__',
          productId: product.id,
          position,
          createdAt: new Date(),
          product,
        }));
      }

      return trendingProducts.map((product, position) => ({
        collectionId: '__auto__',
        productId: product.id,
        position,
        createdAt: new Date(),
        product,
      }));
    }

    const products = await this.prisma.product.findMany({
      where,
      include: { variants: true, category: true },
      orderBy: rules.includeIfNewArrival
        ? { createdAt: 'desc' }
        : { createdAt: 'desc' },
      take: rules.maxProducts ?? 24,
    });

    // Shape result like CollectionProduct join rows so the controller / web
    // can render either path uniformly.
    return products.map((product, position) => ({
      collectionId: '__auto__',
      productId: product.id,
      position,
      createdAt: new Date(),
      product,
    }));
  }
}
