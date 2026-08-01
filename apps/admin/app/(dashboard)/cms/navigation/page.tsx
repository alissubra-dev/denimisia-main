'use client';

/**
 * Navigation Menus editor.
 *
 * One friendly page that surfaces every admin-editable tile behind the
 * top-nav interactions (Shop, Collection, Series mega-menu) plus the
 * Search overlay category tiles and the Shop-by-Fit carousel tiles.
 *
 * Each tile is a PageSlot row; this page groups them by menu and exposes
 * image upload + tile label + tile link + alt text in a single card.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { PageShell } from '@/components/page-shell';
import {
  Banner,
  EmptyState,
  SkeletonList,
  SurfaceCard,
  SurfaceHeader,
} from '@/components/admin-ui';
import type { PageSlotRecord } from '../media/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1) } KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function isNavMegaMenuSlot(s: PageSlotRecord): boolean {
  return s.pageKey === 'nav';
}

function isSearchCategorySlot(s: PageSlotRecord): boolean {
  return s.pageKey === 'search' && s.groupKey === 'search.popular_categories';
}

function isFitSlot(s: PageSlotRecord): boolean {
  return s.pageKey === 'shop' && s.slotKey.startsWith('fit_');
}

export default function NavigationMenusPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [navSlots, setNavSlots]     = useState<PageSlotRecord[]>([]);
  const [searchSlots, setSearchSlots] = useState<PageSlotRecord[]>([]);
  const [shopSlots, setShopSlots]   = useState<PageSlotRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Three parallel fetches — each pageKey is its own cache namespace
      // and admins typically only edit one surface at a time.
      const [nav, search, shop] = await Promise.all([
        adminFetch<{ slots: PageSlotRecord[] }>('/media/slots?page=nav', token),
        adminFetch<{ slots: PageSlotRecord[] }>('/media/slots?page=search', token),
        adminFetch<{ slots: PageSlotRecord[] }>('/media/slots?page=shop', token),
      ]);
      setNavSlots(nav.slots ?? []);
      setSearchSlots(search.slots ?? []);
      setShopSlots(shop.slots ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load navigation slots.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const megaMenu = useMemo(
    () => navSlots.filter(isNavMegaMenuSlot).sort((a, b) => a.position - b.position),
    [navSlots],
  );
  const searchTiles = useMemo(
    () => searchSlots.filter(isSearchCategorySlot).sort((a, b) => a.position - b.position),
    [searchSlots],
  );
  const fitTiles = useMemo(
    () => shopSlots.filter(isFitSlot).sort((a, b) => a.position - b.position),
    [shopSlots],
  );

  const onSlotUpdated = useCallback(
    (pageKey: 'nav' | 'search' | 'shop', updated: PageSlotRecord) => {
      if (pageKey === 'nav')   setNavSlots((p)   => p.map((s)   => (s.id === updated.id ? updated : s)));
      if (pageKey === 'search') setSearchSlots((p) => p.map((s) => (s.id === updated.id ? updated : s)));
      if (pageKey === 'shop')  setShopSlots((p)  => p.map((s)  => (s.id === updated.id ? updated : s)));
    },
    [],
  );

  return (
    <PageShell
      breadcrumbs={[{ label: 'CMS' }, { label: 'Navigation Menus' }]}
      title="Navigation Menus"
      description="Edit every image, label, and link shown when shoppers hover the top nav or click the search button."
    >
      {error && (
        <div className="mb-4">
          <Banner tone="error" message={error} />
        </div>
      )}

      {loading ? (
        <SkeletonList rows={6} rowHeight={120} />
      ) : (
        <div className="space-y-10">
          <Section
            title="Mega-menu featured images"
            description="Tiles shown when shoppers hover 'Shop', 'Collection', or 'Series' in the top nav."
            empty={megaMenu.length === 0}
            emptyMessage="No mega-menu slots configured. Re-run pnpm --filter database seed:media to add the five featured_shop_* slots."
          >
            {megaMenu.map((slot) => (
              <TileCard
                key={slot.id}
                pageKey="nav"
                slot={slot}
                token={token}
                onSaved={(updated) => onSlotUpdated('nav', updated)}
              />
            ))}
          </Section>

          <Section
            title="Search overlay category tiles"
            description="The three large tiles in the search overlay (under 'Shop by category')."
            empty={searchTiles.length === 0}
            emptyMessage="No search overlay tiles configured."
          >
            {searchTiles.map((slot) => (
              <TileCard
                key={slot.id}
                pageKey="search"
                slot={slot}
                token={token}
                onSaved={(updated) => onSlotUpdated('search', updated)}
              />
            ))}
          </Section>

          <Section
            title="Shop by Fit carousel tiles"
            description="The 11 tile carousel at the top of /shop."
            empty={fitTiles.length === 0}
            emptyMessage="No Shop-by-Fit slots configured."
          >
            {fitTiles.map((slot) => (
              <TileCard
                key={slot.id}
                pageKey="shop"
                slot={slot}
                token={token}
                onSaved={(updated) => onSlotUpdated('shop', updated)}
              />
            ))}
          </Section>
        </div>
      )}
    </PageShell>
  );
}

function Section({
  title,
  description,
  empty,
  emptyMessage,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly empty: boolean;
  readonly emptyMessage: string;
  readonly children: React.ReactNode;
}) {
  return (
    <SurfaceCard>
      <SurfaceHeader>
        <div className="flex flex-col gap-1">
          <span>{title}</span>
          <span className="font-sans text-[11px] font-normal normal-case tracking-normal text-secondary">
            {description}
          </span>
        </div>
      </SurfaceHeader>
      {empty ? (
        <div className="p-6">
          <EmptyState icon="inventory_2" label="No slots yet" description={emptyMessage} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
      )}
    </SurfaceCard>
  );
}

interface TileCardProps {
  readonly pageKey: 'nav' | 'search' | 'shop';
  readonly slot: PageSlotRecord;
  readonly token: string | undefined;
  readonly onSaved: (updated: PageSlotRecord) => void;
}

function TileCard({ pageKey, slot, token, onSaved }: TileCardProps) {
  const [tileLabel, setTileLabel] = useState(slot.tileLabel ?? '');
  const [tileHref,  setTileHref]  = useState(slot.tileHref  ?? '');
  const [altText,   setAltText]   = useState(slot.altText   ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTileLabel(slot.tileLabel ?? '');
    setTileHref(slot.tileHref ?? '');
    setAltText(slot.altText ?? '');
  }, [slot.id, slot.tileLabel, slot.tileHref, slot.altText]);

  const onUpload = useCallback(async (file: File | null) => {
    if (!file || !token) return;
    if (file.size > slot.maxBytes) {
      setError(`File is ${formatBytes(file.size)} — max is ${formatBytes(slot.maxBytes)}.`);
      return;
    }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(
        `${API}/media/admin/upload?page=${pageKey}&slot=${slot.slotKey}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Upload failed: ${res.status}`);
      }
      const json = await res.json();
      const updated = (json.data ?? json) as PageSlotRecord;
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [token, slot.maxBytes, pageKey, slot.slotKey, onSaved]);

  const onSave = useCallback(async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const updated = await adminFetch<PageSlotRecord>(
        `/media/admin/slots/${pageKey}/${slot.slotKey}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({ tileLabel, tileHref, altText }),
        },
      );
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [token, pageKey, slot.slotKey, tileLabel, tileHref, altText, onSaved]);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-low">
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          void onUpload(e.dataTransfer.files[0] ?? null);
        }}
        className="group relative flex aspect-[4/5] cursor-pointer items-center justify-center overflow-hidden bg-ink/[0.04]"
      >
        {slot.asset?.publicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slot.asset.publicUrl}
            alt={slot.altText ?? slot.tileLabel ?? slot.label}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="text-center px-4">
            <span className="material-symbols-outlined text-3xl text-secondary">image</span>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-secondary">
              Click or drop image
            </p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/80">
            <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { void onUpload(e.target.files?.[0] ?? null); }}
      />

      <div className="flex flex-col gap-3 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
          {pageKey} / {slot.slotKey}
        </p>

        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
            Tile label
          </span>
          <input
            type="text"
            value={tileLabel}
            onChange={(e) => setTileLabel(e.target.value)}
            placeholder="(uses hardcoded label if empty)"
            className="w-full rounded-md border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 font-body text-sm text-on-surface focus:border-primary focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
            Tile link
          </span>
          <input
            type="text"
            value={tileHref}
            onChange={(e) => setTileHref(e.target.value)}
            placeholder="(uses hardcoded link if empty)"
            className="w-full rounded-md border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 font-body text-sm text-on-surface focus:border-primary focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-secondary">
            Alt text
          </span>
          <input
            type="text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            placeholder="For accessibility"
            className="w-full rounded-md border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 font-body text-sm text-on-surface focus:border-primary focus:outline-none"
          />
        </label>

        {error && (
          <p className="font-mono text-xs text-error">{error}</p>
        )}

        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="mt-1 rounded-full bg-primary px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
