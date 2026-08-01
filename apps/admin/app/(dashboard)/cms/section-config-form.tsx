'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  type HomepageSectionType,
  SECTION_TYPE_META,
  HAS_CONFIG_FIELDS,
  SLOT_TYPE_INFO,
  DEFAULT_SLOT_KEYS,
  DEFAULT_SLOT_GROUP_KEYS,
} from './section-types';
import { adminFetch } from '@/lib/api';

interface PageSlotRecord {
  readonly id: string;
  readonly slotKey: string;
  readonly pageKey: string;
  readonly groupKey: string | null;
  readonly position: number;
  readonly isActive: boolean;
}

interface SectionConfigFormProps {
  readonly type: HomepageSectionType;
  readonly initial: Record<string, unknown>;
  readonly onSubmit: (config: Record<string, unknown>) => Promise<void>;
  readonly onCancel: () => void;
}

const KEY_REGEX = /^[a-z0-9._-]{2,80}$/;

function getInitialSlotKey(
  initial: Record<string, unknown>,
  fallback: string,
): string {
  return typeof initial.slotKey === 'string' && initial.slotKey
    ? initial.slotKey
    : fallback;
}

function getInitialSlotGroupKey(
  initial: Record<string, unknown>,
  fallback: string,
): string {
  return typeof initial.slotGroupKey === 'string' && initial.slotGroupKey
    ? initial.slotGroupKey
    : fallback;
}

/**
 * Per-type config editor. Each section type that has editable fields gets
 * its own form. Slot-driven sections (HERO, CATEGORY_CARDS, BRAND_STORY,
 * EDITORIAL_BANNER) render slot pickers that allow the admin to choose
 * an existing slot or type a new key (the API auto-creates a default slot
 * on save).
 */
export function SectionConfigForm({
  type,
  initial,
  onSubmit,
  onCancel,
}: SectionConfigFormProps) {
  const meta = SECTION_TYPE_META[type];
  const editable = HAS_CONFIG_FIELDS.has(type);

  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [title, setTitle] = useState(
    typeof initial.title === 'string' ? initial.title : '',
  );
  const [limit, setLimit] = useState(
    typeof initial.limit === 'number' ? String(initial.limit) : '',
  );
  const [slotGroupKey, setSlotGroupKey] = useState(
    getInitialSlotGroupKey(initial, DEFAULT_SLOT_GROUP_KEYS[type] ?? ''),
  );
  const [collectionSlug, setCollectionSlug] = useState(
    typeof initial.collectionSlug === 'string' ? initial.collectionSlug : '',
  );
  const [slotKey, setSlotKey] = useState(
    getInitialSlotKey(initial, DEFAULT_SLOT_KEYS[type] ?? ''),
  );
  const [slotKeyPrefix, setSlotKeyPrefix] = useState(
    typeof initial.slotKeyPrefix === 'string' ? initial.slotKeyPrefix : '',
  );

  const [slots, setSlots] = useState<PageSlotRecord[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch all home slots so the picker dropdowns can list existing keys.
  useEffect(() => {
    let cancelled = false;
    setSlotsLoading(true);
    adminFetch<{ slots: PageSlotRecord[] }>('/media/slots?page=home', token)
      .then((data) => {
        if (!cancelled) {
          setSlots(data?.slots ?? []);
          setSlotsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const singleSlotOptions = useMemo(
    () =>
      slots
        .filter((s) => !s.groupKey && s.slotKey)
        .map((s) => s.slotKey)
        .sort(),
    [slots],
  );
  const groupSlotOptions = useMemo(
    () =>
      Array.from(
        new Set(slots.map((s) => s.groupKey).filter((k): k is string => !!k)),
      ).sort(),
    [slots],
  );

  const slotKind = SLOT_TYPE_INFO[type];

  // Existing keys for warnings
  const allUsedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const s of slots) {
      if (s.slotKey) set.add(s.slotKey);
      if (s.groupKey) set.add(s.groupKey);
    }
    return set;
  }, [slots]);

  const ensureSlot = async (
    pageKey: string,
    slotKeyToEnsure: string,
    groupKeyToEnsure?: string,
  ) => {
    await adminFetch('/media/admin/slots/ensure', token, {
      method: 'POST',
      body: JSON.stringify({
        pageKey,
        slotKey: slotKeyToEnsure,
        groupKey: groupKeyToEnsure,
      }),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const config: Record<string, unknown> = {};
      if (type === 'NEW_ARRIVALS' || type === 'BUNDLE_DEALS' || type === 'TRENDING') {
        if (title.trim()) config.title = title.trim();
        const limitNum = Number(limit);
        if (Number.isFinite(limitNum) && limitNum > 0) config.limit = Math.floor(limitNum);
      } else if (type === 'EDITORIAL_BANNER') {
        const trimmedGroup = slotGroupKey.trim();
        if (!trimmedGroup) throw new Error('Slot group key is required');
        if (!KEY_REGEX.test(trimmedGroup)) {
          throw new Error(
            'Slot group key must be 2-80 chars: a-z, 0-9, dot, dash, underscore.',
          );
        }
        if (!allUsedKeys.has(trimmedGroup)) {
          await ensureSlot('home', `${trimmedGroup}_seed_1`, trimmedGroup);
        }
        config.slotGroupKey = trimmedGroup;
        if (slotKeyPrefix.trim()) config.slotKeyPrefix = slotKeyPrefix.trim();
      } else if (type === 'BESTSELLERS') {
        if (title.trim()) config.title = title.trim();
        if (collectionSlug.trim()) config.collectionSlug = collectionSlug.trim();
      } else if (type === 'HERO' || type === 'BRAND_STORY') {
        const trimmedKey = slotKey.trim();
        if (!trimmedKey) throw new Error('Slot key is required');
        if (!KEY_REGEX.test(trimmedKey)) {
          throw new Error(
            'Slot key must be 2-80 chars: a-z, 0-9, dot, dash, underscore.',
          );
        }
        if (!allUsedKeys.has(trimmedKey)) {
          await ensureSlot('home', trimmedKey);
        }
        config.slotKey = trimmedKey;
      } else if (type === 'CATEGORY_CARDS') {
        const trimmedGroup = slotGroupKey.trim();
        if (!trimmedGroup) throw new Error('Slot group key is required');
        if (!KEY_REGEX.test(trimmedGroup)) {
          throw new Error(
            'Slot group key must be 2-80 chars: a-z, 0-9, dot, dash, underscore.',
          );
        }
        if (!allUsedKeys.has(trimmedGroup)) {
          await ensureSlot(
            'home',
            `${trimmedGroup.replace(/[^a-z0-9_-]/g, '_')}_seed_1`,
            trimmedGroup,
          );
        }
        config.slotGroupKey = trimmedGroup;
      }
      await onSubmit(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  };

  if (!editable) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-on-surface">{meta.description}</p>
        <p className="text-xs text-secondary">
          This section&apos;s content (images, headings, CTAs) is managed
          {meta.contentEditor ? (
            <>
              {' '}via{' '}
              <a
                href={meta.contentEditor}
                className="underline hover:text-on-surface"
              >
                {meta.contentEditor.replace('/cms/', 'CMS → ')}
              </a>
              .
            </>
          ) : (
            <>{' '}elsewhere in the admin.</>
          )}
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary hover:text-on-surface"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-on-surface">{meta.description}</p>

      {slotKind === 'single' && (
        <SlotKeyPicker
          label="Slot key"
          hint="Which slot this section renders. Defaults map to the primary slot."
          value={slotKey}
          onChange={setSlotKey}
          options={singleSlotOptions}
          loading={slotsLoading}
        />
      )}

      {slotKind === 'group' && (
        <>
          <SlotGroupKeyPicker
            label="Slot group key"
            hint="All slots sharing this group key are rendered together (in position order). Use a different key for each carousel/grid instance."
            value={slotGroupKey}
            onChange={setSlotGroupKey}
            options={groupSlotOptions}
            loading={slotsLoading}
          />
          {type === 'EDITORIAL_BANNER' && (
            <Field
              label="Slot key prefix (optional)"
              hint="Scopes the slide's data-slot attribute so two editorial banners don't collide on the same page (e.g. secondary)."
            >
              <input
                type="text"
                value={slotKeyPrefix}
                onChange={(e) => setSlotKeyPrefix(e.target.value)}
                placeholder="secondary"
                className="w-full rounded border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-on-surface focus:outline-none"
              />
            </Field>
          )}
        </>
      )}

      {(type === 'NEW_ARRIVALS' ||
        type === 'BUNDLE_DEALS' ||
        type === 'TRENDING' ||
        type === 'BESTSELLERS') && (
        <Field label="Section title">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={String(meta.defaultConfig.title ?? '')}
            className="w-full rounded border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-on-surface focus:outline-none"
          />
        </Field>
      )}

      {(type === 'NEW_ARRIVALS' ||
        type === 'BUNDLE_DEALS' ||
        type === 'TRENDING') && (
        <Field label="Limit" hint="Max number of items shown.">
          <input
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder={String(meta.defaultConfig.limit ?? '')}
            className="w-32 rounded border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-on-surface focus:outline-none"
          />
        </Field>
      )}

      {type === 'BESTSELLERS' && (
        <Field
          label="Collection slug (optional)"
          hint="Override the bestseller source collection."
        >
          <input
            type="text"
            value={collectionSlug}
            onChange={(e) => setCollectionSlug(e.target.value)}
            placeholder="bestsellers"
            className="w-full rounded border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-on-surface focus:outline-none"
          />
        </Field>
      )}

      {error && <div className="text-xs text-[#c62828]">{error}</div>}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-secondary hover:text-on-surface"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-inverse-surface text-inverse-on-surface text-[10px] font-bold uppercase tracking-[0.2em] hover:scale-[1.02] disabled:opacity-50 transition-transform"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

interface SlotKeyPickerProps {
  readonly label: string;
  readonly hint?: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly options: readonly string[];
  readonly loading: boolean;
}

function SlotKeyPicker({ label, hint, value, onChange, options, loading }: SlotKeyPickerProps) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-col gap-2">
        <select
          value={options.includes(value) ? value : '__custom__'}
          onChange={(e) => {
            if (e.target.value !== '__custom__') onChange(e.target.value);
            else onChange('');
          }}
          className="w-full rounded border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-on-surface focus:outline-none"
        >
          {loading ? (
            <option value="">Loading…</option>
          ) : options.length === 0 ? (
            <option value="">No existing slots</option>
          ) : (
            options.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))
          )}
          <option value="__custom__">— Type a new key —</option>
        </select>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. hero_alt_1"
          className="w-full rounded border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-on-surface focus:outline-none"
        />
        {value && !options.includes(value) && (
          <p className="text-[10px] text-secondary">
            New key — a default slot row will be created on save.
          </p>
        )}
      </div>
    </Field>
  );
}

function SlotGroupKeyPicker({
  label,
  hint,
  value,
  onChange,
  options,
  loading,
}: SlotKeyPickerProps) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-col gap-2">
        <select
          value={options.includes(value) ? value : '__custom__'}
          onChange={(e) => {
            if (e.target.value !== '__custom__') onChange(e.target.value);
            else onChange('');
          }}
          className="w-full rounded border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-on-surface focus:outline-none"
        >
          {loading ? (
            <option value="">Loading…</option>
          ) : options.length === 0 ? (
            <option value="">No existing groups</option>
          ) : (
            options.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))
          )}
          <option value="__custom__">— Type a new group key —</option>
        </select>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. home.editorial_secondary"
          className="w-full rounded border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface focus:border-on-surface focus:outline-none"
        />
        {value && !options.includes(value) && (
          <p className="text-[10px] text-secondary">
            New group — a default seed slot will be created on save.
          </p>
        )}
      </div>
    </Field>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-secondary">{hint}</span>}
    </label>
  );
}
