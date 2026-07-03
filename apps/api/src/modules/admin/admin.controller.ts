import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { seedSilhouettes } from '../../../packages/database/prisma/seeds/silhouettes';

@Controller('admin/seed')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminSeedController {
  constructor(private prisma: PrismaService) {}

  @Post('silhouettes')
  async seedSilhouettes() {
    await seedSilhouettes(this.prisma);
    return { success: true, message: 'Silhouettes seeded' };
  }

  @Post('categories')
  async seedCategories() {
    // Seed Women's category
    const womens = await this.prisma.category.upsert({
      where: { slug: 'womens' },
      update: {},
      create: { name: "Women's", slug: 'womens', description: "Women's clothing" },
    });

    // Seed subcategories
    const categories = [
      { name: 'Wide Leg', slug: 'womens-wide-leg' },
      { name: 'Baggy', slug: 'womens-baggy' },
      { name: 'Flare & Boot Cut', slug: 'womens-flare' },
      { name: 'Barrel Fit', slug: 'womens-barrel' },
      { name: 'Cargo', slug: 'womens-cargo' },
      { name: 'Straight', slug: 'womens-straight' },
      { name: 'Skinny', slug: 'womens-skinny' },
      { name: 'Jogger', slug: 'womens-jogger' },
    ];

    for (const cat of categories) {
      await this.prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: { name: cat.name, slug: cat.slug, parentId: womens.id },
      });
    }

    // Seed Men's category
    await this.prisma.category.upsert({
      where: { slug: 'mens' },
      update: {},
      create: { name: "Men's", slug: 'mens', description: "Men's clothing" },
    });

    return { success: true, message: 'Categories seeded' };
  }

  @Post('all')
  async seedAll() {
    await this.seedSilhouettes();
    await this.seedCategories();
    return { success: true, message: 'Database seeded' };
  }
}