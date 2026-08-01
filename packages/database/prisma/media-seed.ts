/**
 * Media slot seed — upserts a PageSlot row for every slot defined in
 * apps/api/src/modules/media/media.config.ts. Idempotent.
 *
 * Run: pnpm --filter database seed:media
 *
 * This populates the slots with their specs + default headings/CTAs.
 * Media assets are NOT uploaded here — the admin does that via /admin/media.
 *
 * Source of truth: SLOT_SPECS in apps/api/src/modules/media/media.config.ts.
 * The seed imports from there directly so adding a slot there is enough.
 */

import { PrismaClient } from '@prisma/client';
import { SLOT_SPECS } from '../../../../apps/api/src/modules/media/media.config';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log(`Media slot seed — ${SLOT_SPECS.length} slots across pages.`);
  let created = 0;
  let updated = 0;

  for (const s of SLOT_SPECS) {
    const existing = await prisma.pageSlot.findFirst({
      where: { pageKey: s.pageKey, slotKey: s.slotKey },
    });
    if (existing) {
      await prisma.pageSlot.update({
        where: { id: existing.id },
        data: {
          label:        s.label,
          mediaKind:    s.mediaKind,
          acceptsVideo: s.acceptsVideo,
          specWidth:    s.specWidth,
          specHeight:   s.specHeight,
          specAspect:   s.specAspect,
          maxBytes:     s.maxBytes,
          position:     s.position ?? 0,
          groupKey:     s.groupKey ?? null,
        },
      });
      updated += 1;
    } else {
      await prisma.pageSlot.create({
        data: {
          pageKey:      s.pageKey,
          slotKey:      s.slotKey,
          label:        s.label,
          mediaKind:    s.mediaKind,
          acceptsVideo: s.acceptsVideo,
          specWidth:    s.specWidth,
          specHeight:   s.specHeight,
          specAspect:   s.specAspect,
          maxBytes:     s.maxBytes,
          position:     s.position ?? 0,
          groupKey:     s.groupKey ?? null,
          heading:      s.defaultHeading ?? null,
          subheading:   s.defaultSubheading ?? null,
          body:         s.defaultBody ?? null,
          ctaLabel:     s.defaultCtaLabel ?? null,
          ctaHref:      s.defaultCtaHref ?? null,
        },
      });
      created += 1;
    }
  }

  const pageCounts = await prisma.pageSlot.groupBy({
    by: ['pageKey'],
    _count: true,
    orderBy: { pageKey: 'asc' },
  });
  console.log(`  created=${created}  updated=${updated}`);
  console.log('  slots per page:');
  for (const p of pageCounts) console.log(`    ${p.pageKey.padEnd(25)} ${p._count}`);
}

main()
  .catch((err: unknown) => {
    const m = err instanceof Error ? err.message : String(err);
    console.error('Media seed failed:', m);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
