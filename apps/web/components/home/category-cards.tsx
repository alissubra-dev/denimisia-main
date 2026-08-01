import Image from 'next/image';
import Link from 'next/link';
import { CATEGORY_CARDS } from '@/lib/constants';
import { fetchPageSlots, pickSlotGroup, resolveSlotText, resolveSlotUrl, type PageSlotRecord } from '@/lib/page-slots';

interface CategoryCardsProps {
  /**
   * Slot group key to read. Defaults to `home.category_cards`. Each
   * CATEGORY_CARDS instance on the homepage can point at a different
   * groupKey (e.g. home.category_cards, home.category_cards_secondary).
   * The number of cards rendered is driven by the slot count in the group.
   */
  readonly slotGroupKey?: string;
}

export async function CategoryCards({ slotGroupKey = 'home.category_cards' }: CategoryCardsProps = {}) {
  const slots = await fetchPageSlots('home');
  const cardSlots = pickSlotGroup(slots, slotGroupKey);

  // If the group has zero slots, fall back to the legacy 3-card default.
  // Otherwise render every slot in the group, in position order.
  const cards =
    cardSlots.length > 0
      ? cardSlots.map((slot, i) => buildCard(slot, i))
      : CATEGORY_CARDS.map((fallback, i) => buildCard(undefined, i, fallback));

  return (
    <section
      data-slot-group={`home.${slotGroupKey}`}
      className="denimisia-category-gallery grid grid-cols-1 md:h-[696px] md:grid-cols-3"
    >
      {cards.map((card) => (
        <Link
          key={card.slotKey}
          data-slot={`home.${card.slotKey}`}
          data-slot-field="ctaHref"
          href={card.href}
          className="group relative h-[532px] overflow-hidden md:h-full"
        >
          <Image
            data-slot-field="media"
            src={card.image}
            alt={card.alt}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent opacity-40" />
          <div className="absolute bottom-12 left-12">
            <h3
              data-slot-field="heading"
              className="text-2xl font-bold uppercase tracking-[0.3em] text-paper"
            >
              {card.label}
            </h3>
            <p
              data-slot-field="subheading"
              className="mt-2 text-xs uppercase tracking-widest text-paper/70"
            >
              {card.subtitle}
            </p>
          </div>
        </Link>
      ))}
    </section>
  );
}

function buildCard(
  slot: PageSlotRecord | undefined,
  i: number,
  fallback?: (typeof CATEGORY_CARDS)[number],
) {
  const { src } = resolveSlotUrl(slot, fallback?.image ?? '');
  return {
    slotKey: slot?.slotKey ?? `category_card_${i + 1}`,
    href:    resolveSlotText(slot, fallback?.href ?? '#', 'ctaHref'),
    label:   resolveSlotText(slot, fallback?.label ?? 'Category', 'heading'),
    subtitle: resolveSlotText(slot, fallback?.subtitle ?? '', 'subheading'),
    image:   src,
    alt:     slot?.altText ?? fallback?.label ?? 'Category',
  };
}

