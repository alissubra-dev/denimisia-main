/**
 * Core Media service — upload, list/update slots, version history.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MediaKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from './r2-storage.service';
import { MediaProcessingService } from './media-processing.service';
import { findSpec, SLOT_SPECS, type SlotSpec } from './media.config';
import type { CreateSlotDto, UpdateSlotDto } from './media.dto';

const HISTORY_PER_SLOT = 10;

export interface UploadInput {
  readonly pageKey: string;
  readonly slotKey: string;
  readonly buffer: Buffer;
  readonly originalFilename: string;
  readonly uploadedById?: string;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: R2StorageService,
    private readonly processing: MediaProcessingService,
  ) {}

  async listPage(pageKey: string, groupKey?: string) {
    const where: Prisma.PageSlotWhereInput = { pageKey };
    if (groupKey) where.groupKey = groupKey;
    const slots = await this.prisma.pageSlot.findMany({
      where,
      orderBy: [{ groupKey: 'asc' }, { position: 'asc' }],
      include: { asset: true },
    });
    return { slots, specs: SLOT_SPECS.filter((s) => s.pageKey === pageKey) };
  }

  async listByGroup(pageKey: string, groupKey: string) {
    const slots = await this.prisma.pageSlot.findMany({
      where: { pageKey, groupKey },
      orderBy: { position: 'asc' },
      include: { asset: true },
    });
    return { slots };
  }

  /**
   * Returns a sensible default SlotSpec when no entry exists in SLOT_SPECS.
   * Used by createSlot/ensureSlot so ad-hoc slots created from the admin
   * still have a usable cap/aspect without the admin having to hand-tune.
   */
  defaultSpecFor(pageKey: string, slotKey: string): SlotSpec {
    const existing = findSpec(pageKey, slotKey);
    if (existing) return existing;
    return {
      pageKey,
      slotKey,
      label: `${pageKey}.${slotKey}`,
      mediaKind: 'IMAGE',
      acceptsVideo: true,
      specWidth: 2560,
      specHeight: 1440,
      specAspect: '16:9',
      maxBytes: 5 * 1024 * 1024,
    };
  }

  /**
   * Creates a new PageSlot. Auto-derives spec from findSpec() or defaultSpecFor().
   * If a groupKey is supplied, the new slot is appended to the end of that group
   * (MAX(position) + 1) so existing-order is preserved.
   */
  async createSlot(
    pageKey: string,
    slotKey: string,
    dto: CreateSlotDto,
    userId?: string,
  ) {
    const existing = await this.prisma.pageSlot.findFirst({
      where: { pageKey, slotKey },
    });
    if (existing) {
      throw new ConflictException(
        `Slot already exists: ${pageKey}/${slotKey}`,
      );
    }

    const spec = this.defaultSpecFor(pageKey, slotKey);

    let position = dto.position ?? 0;
    if (dto.groupKey && position === 0) {
      const last = await this.prisma.pageSlot.findFirst({
        where: { pageKey, groupKey: dto.groupKey },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = (last?.position ?? -1) + 1;
    }

    const slot = await this.prisma.pageSlot.create({
      data: {
        pageKey,
        slotKey,
        label: dto.label,
        groupKey: dto.groupKey ?? null,
        position,
        mediaKind: (dto.mediaKind ?? spec.mediaKind) as MediaKind,
        acceptsVideo: dto.acceptsVideo ?? spec.acceptsVideo,
        specWidth: dto.specWidth ?? spec.specWidth,
        specHeight: dto.specHeight ?? spec.specHeight,
        specAspect: dto.specAspect ?? spec.specAspect,
        maxBytes: dto.maxBytes ?? spec.maxBytes,
        heading: dto.heading ?? null,
        subheading: dto.subheading ?? null,
        body: dto.body ?? null,
        ctaLabel: dto.ctaLabel ?? null,
        ctaHref: dto.ctaHref ?? null,
        altText: dto.altText ?? null,
      },
      include: { asset: true },
    });

    // Audit history row (with no diff — this is a fresh slot).
    this.logger.log(
      `createSlot: ${pageKey}/${slotKey} groupKey=${dto.groupKey ?? '(none)'} user=${userId ?? 'anon'}`,
    );
    return slot;
  }

  /**
   * Idempotent get-or-create. Used by the admin section composer when adding
   * a new section that references a slotKey/groupKey that may not yet exist.
   * Returns the existing slot if present, otherwise creates one with default spec.
   */
  async ensureSlot(
    pageKey: string,
    slotKey: string,
    groupKey?: string,
    userId?: string,
  ) {
    const existing = await this.prisma.pageSlot.findFirst({
      where: { pageKey, slotKey },
      include: { asset: true },
    });
    if (existing) return existing;

    return this.createSlot(
      pageKey,
      slotKey,
      {
        pageKey,
        slotKey,
        label: `${pageKey}.${slotKey}`,
        groupKey,
      },
      userId,
    );
  }

  async listAll() {
    return this.prisma.pageSlot.findMany({
      orderBy: [{ pageKey: 'asc' }, { groupKey: 'asc' }, { position: 'asc' }],
      include: { asset: true },
    });
  }

  async storageStats(): Promise<{
    totalBytes: number;
    totalAssets: number;
    byKind: Record<MediaKind, number>;
  }> {
    // Single SQL with SUM + COUNT per kind (LR-001 BUG #12). The pre-fix
    // shape did a full-table findMany then summed in JS, which scaled
    // O(N) in both DB transfer and process memory. groupBy returns one
    // row per MediaKind (currently IMAGE + VIDEO) — O(K).
    const grouped = await this.prisma.mediaAsset.groupBy({
      by: ['kind'],
      _sum: { bytes: true },
      _count: { _all: true },
    });
    const byKind: Record<MediaKind, number> = { IMAGE: 0, VIDEO: 0 };
    let totalBytes = 0;
    let totalAssets = 0;
    for (const g of grouped) {
      const sumBytes = g._sum.bytes ?? 0;
      byKind[g.kind] = sumBytes;
      totalBytes += sumBytes;
      totalAssets += g._count._all;
    }
    return { totalBytes, totalAssets, byKind };
  }

  /**
   * Uploads a file and returns the created MediaAsset — without attaching it
   * to a PageSlot. Used by curation (section thumbnails) and other places
   * that need a raw asset. 5MB image / 40MB video cap.
   */
  async uploadAsset(
    buffer: Buffer,
    uploadedById?: string,
    originalFilename?: string,
  ) {
    if (buffer.byteLength > 40 * 1024 * 1024) {
      throw new BadRequestException(
        `File too large: ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB — max 40MB`,
      );
    }
    const mime = await this.processing.detectMime(buffer);
    const isImage = this.processing.isImage(mime);
    const isVideo = this.processing.isVideo(mime);
    if (!isImage && !isVideo)
      throw new BadRequestException(`Unsupported media type: ${mime}`);

    // Forensic trail: the schema doesn't have an originalFilename column yet,
    // so until that's added log it alongside the uploader for audit.
    if (originalFilename) {
      this.logger.log(
        `uploadAsset: filename="${originalFilename}" mime=${mime} uploader=${uploadedById ?? 'anon'} bytes=${buffer.byteLength}`,
      );
    }

    const contentHash = this.processing.contentHash(buffer);
    const existing = await this.prisma.mediaAsset.findUnique({
      where: { contentHash },
    });
    if (existing) return existing;

    const kind: MediaKind = isVideo ? 'VIDEO' : 'IMAGE';
    const pathBase = `misc/${contentHash.slice(0, 12)}`;

    if (isImage) {
      const meta = await this.processing.readImageMeta(buffer);
      const ext = mime.split('/')[1] ?? 'bin';
      const path = `${pathBase}.${ext}`;
      await this.storage.uploadOriginal(path, buffer, mime);
      const pub = await this.storage.uploadPublic(path, buffer, mime);
      return this.prisma.mediaAsset.create({
        data: {
          kind,
          mime,
          bytes: meta.bytes,
          width: meta.width,
          height: meta.height,
          originalUrl: `${this.storage.getOriginalsBucket()}/${path}`,
          publicUrl: pub.publicUrl,
          storageBucket: this.storage.getPublicBucket(),
          storagePath: path,
          contentHash,
          uploadedById,
        },
      });
    } else {
      const video = await this.processing.transcodeVideo(buffer);
      const originalPath = `${pathBase}.original`;
      const mp4Path = `${pathBase}.mp4`;
      const posterPath = `${pathBase}.poster.jpg`;
      await this.storage.uploadOriginal(originalPath, buffer, mime);
      const mp4Up = await this.storage.uploadPublic(
        mp4Path,
        video.mp4,
        'video/mp4',
      );
      const posterUp = await this.storage.uploadPublic(
        posterPath,
        video.poster,
        'image/jpeg',
      );
      return this.prisma.mediaAsset.create({
        data: {
          kind,
          mime: 'video/mp4',
          bytes: video.bytes,
          width: video.width,
          height: video.height,
          durationMs: video.durationMs,
          originalUrl: `${this.storage.getOriginalsBucket()}/${originalPath}`,
          publicUrl: mp4Up.publicUrl,
          posterUrl: posterUp.publicUrl,
          storageBucket: this.storage.getPublicBucket(),
          storagePath: mp4Path,
          contentHash,
          uploadedById,
        },
      });
    }
  }

  async upload(input: UploadInput) {
    const spec = this.defaultSpecFor(input.pageKey, input.slotKey);
    if (spec.maxBytes === 0)
      throw new BadRequestException('This slot is text-only.');

    if (input.buffer.byteLength > spec.maxBytes) {
      throw new BadRequestException(
        `File is ${(input.buffer.byteLength / 1024 / 1024).toFixed(1)}MB — max is ${(spec.maxBytes / 1024 / 1024).toFixed(0)}MB.`,
      );
    }

    const mime = await this.processing.detectMime(input.buffer);
    const isImage = this.processing.isImage(mime);
    const isVideo = this.processing.isVideo(mime);

    if (isVideo && !spec.acceptsVideo) {
      throw new BadRequestException(`${spec.label} does not accept video.`);
    }
    if (!isImage && !isVideo) {
      throw new BadRequestException(`Unsupported media type: ${mime}`);
    }

    const contentHash = this.processing.contentHash(input.buffer);

    // Dedupe: if we've already uploaded this exact file, reuse it.
    const existing = await this.prisma.mediaAsset.findUnique({
      where: { contentHash },
    });
    if (existing) {
      this.logger.log(
        `Dedup hit: asset=${existing.id} — reusing for ${input.slotKey}.`,
      );
      return this.attachAssetToSlot(
        input.pageKey,
        input.slotKey,
        existing.id,
        input.uploadedById,
      );
    }

    const kind: MediaKind = isVideo ? 'VIDEO' : 'IMAGE';
    const pathBase = `${input.pageKey}/${input.slotKey}/${contentHash.slice(0, 12)}`;

    let width = 0;
    let height = 0;
    let durationMs: number | undefined;
    let publicUrl: string;
    let posterUrl: string | undefined;
    let originalPath: string;
    let publicPath: string;
    let storedBytes: number;
    let storedMime: string;

    if (isImage) {
      const meta = await this.processing.readImageMeta(input.buffer);
      width = meta.width;
      height = meta.height;
      const ext = mime.split('/')[1] ?? 'bin';
      originalPath = `${pathBase}.${ext}`;
      publicPath = originalPath;
      storedBytes = meta.bytes;
      storedMime = mime;

      await this.storage.uploadOriginal(originalPath, input.buffer, mime);
      const pub = await this.storage.uploadPublic(
        publicPath,
        input.buffer,
        mime,
      );
      publicUrl = pub.publicUrl;
    } else {
      const video = await this.processing.transcodeVideo(input.buffer);
      width = video.width;
      height = video.height;
      durationMs = video.durationMs;

      originalPath = `${pathBase}.original`;
      publicPath = `${pathBase}.mp4`;
      const posterPath = `${pathBase}.poster.jpg`;
      storedBytes = video.bytes;
      storedMime = 'video/mp4';

      await this.storage.uploadOriginal(originalPath, input.buffer, mime);
      const mp4Up = await this.storage.uploadPublic(
        publicPath,
        video.mp4,
        'video/mp4',
      );
      const posterUp = await this.storage.uploadPublic(
        posterPath,
        video.poster,
        'image/jpeg',
      );
      publicUrl = mp4Up.publicUrl;
      posterUrl = posterUp.publicUrl;
    }

    const asset = await this.prisma.mediaAsset.create({
      data: {
        kind,
        mime: storedMime,
        bytes: storedBytes,
        width,
        height,
        durationMs,
        originalUrl: `${this.storage.getOriginalsBucket()}/${originalPath}`,
        publicUrl,
        posterUrl,
        storageBucket: this.storage.getPublicBucket(),
        storagePath: publicPath,
        contentHash,
        uploadedById: input.uploadedById,
      },
    });

    return this.attachAssetToSlot(
      input.pageKey,
      input.slotKey,
      asset.id,
      input.uploadedById,
    );
  }

  async updateSlot(
    pageKey: string,
    slotKey: string,
    dto: UpdateSlotDto,
    userId?: string,
  ) {
    const slot = await this.prisma.pageSlot.findFirst({
      where: { pageKey, slotKey },
      include: { asset: true },
    });
    if (!slot)
      throw new NotFoundException(`Slot not found: ${pageKey}/${slotKey}`);

    const beforeSnapshot = this.snapshot(slot);
    const data: Prisma.PageSlotUpdateInput = {};
    if (dto.heading !== undefined) data.heading = dto.heading;
    if (dto.subheading !== undefined) data.subheading = dto.subheading;
    if (dto.body !== undefined) data.body = dto.body;
    if (dto.ctaLabel !== undefined) data.ctaLabel = dto.ctaLabel;
    if (dto.ctaHref !== undefined) data.ctaHref = dto.ctaHref;
    if (dto.altText !== undefined) data.altText = dto.altText;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.assetId !== undefined) {
      data.asset = dto.assetId
        ? { connect: { id: dto.assetId } }
        : { disconnect: true };
    }
    if (dto.groupKey !== undefined) {
      data.groupKey = dto.groupKey || null;
    }

    const updated = await this.prisma.pageSlot.update({
      where: { id: slot.id },
      data,
      include: { asset: true },
    });

    await this.writeHistory(slot.id, beforeSnapshot, userId);
    return updated;
  }

  async rollback(slotId: string, historyId: string, userId?: string) {
    const [slot, history] = await Promise.all([
      this.prisma.pageSlot.findUnique({
        where: { id: slotId },
        include: { asset: true },
      }),
      this.prisma.pageSlotHistory.findUnique({ where: { id: historyId } }),
    ]);
    if (!slot) throw new NotFoundException('Slot not found');
    if (!history) throw new NotFoundException('History entry not found');
    if (history.slotId !== slotId)
      throw new BadRequestException('History does not belong to this slot');

    const beforeSnapshot = this.snapshot(slot);
    const updated = await this.prisma.pageSlot.update({
      where: { id: slotId },
      data: {
        heading: history.heading,
        subheading: history.subheading,
        body: history.body,
        ctaLabel: history.ctaLabel,
        ctaHref: history.ctaHref,
        altText: history.altText,
        asset: history.assetId
          ? { connect: { id: history.assetId } }
          : { disconnect: true },
      },
      include: { asset: true },
    });
    await this.writeHistory(slotId, beforeSnapshot, userId);
    return updated;
  }

  async historyFor(slotId: string) {
    return this.prisma.pageSlotHistory.findMany({
      where: { slotId },
      orderBy: { replacedAt: 'desc' },
      include: { asset: true },
      take: HISTORY_PER_SLOT,
    });
  }

  private async attachAssetToSlot(
    pageKey: string,
    slotKey: string,
    assetId: string,
    userId?: string,
  ) {
    const slot = await this.prisma.pageSlot.findFirst({
      where: { pageKey, slotKey },
      include: { asset: true },
    });
    if (!slot)
      throw new NotFoundException(`Slot not found: ${pageKey}/${slotKey}`);
    const beforeSnapshot = this.snapshot(slot);

    const updated = await this.prisma.pageSlot.update({
      where: { id: slot.id },
      data: { asset: { connect: { id: assetId } } },
      include: { asset: true },
    });

    await this.writeHistory(slot.id, beforeSnapshot, userId);
    return updated;
  }

  private snapshot(slot: {
    assetId: string | null;
    heading: string | null;
    subheading: string | null;
    body: string | null;
    ctaLabel: string | null;
    ctaHref: string | null;
    altText: string | null;
  }) {
    return {
      assetId: slot.assetId,
      heading: slot.heading,
      subheading: slot.subheading,
      body: slot.body,
      ctaLabel: slot.ctaLabel,
      ctaHref: slot.ctaHref,
      altText: slot.altText,
    };
  }

  private async writeHistory(
    slotId: string,
    snap: ReturnType<MediaService['snapshot']>,
    userId?: string,
  ) {
    await this.prisma.pageSlotHistory.create({
      data: {
        slotId,
        assetId: snap.assetId,
        heading: snap.heading,
        subheading: snap.subheading,
        body: snap.body,
        ctaLabel: snap.ctaLabel,
        ctaHref: snap.ctaHref,
        altText: snap.altText,
        replacedById: userId,
      },
    });
    const excess = await this.prisma.pageSlotHistory.findMany({
      where: { slotId },
      orderBy: { replacedAt: 'desc' },
      skip: HISTORY_PER_SLOT,
      select: { id: true },
    });
    if (excess.length > 0) {
      await this.prisma.pageSlotHistory.deleteMany({
        where: { id: { in: excess.map((e) => e.id) } },
      });
    }
  }
}
