import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateSlotDto {
  @IsOptional() @IsString() assetId?: string | null;
  @IsOptional() @IsString() @MaxLength(500) heading?: string;
  @IsOptional() @IsString() @MaxLength(1000) subheading?: string;
  @IsOptional() @IsString() @MaxLength(20000) body?: string;
  @IsOptional() @IsString() @MaxLength(200) ctaLabel?: string;
  @IsOptional() @IsString() @MaxLength(500) ctaHref?: string;
  @IsOptional() @IsString() @MaxLength(500) altText?: string;
  @IsOptional() @IsString() @MaxLength(200) tileLabel?: string;
  @IsOptional() @IsString() @MaxLength(500) tileHref?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() position?: number;
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^[a-z0-9._-]{2,80}$/, {
    message: 'groupKey must be lowercase kebab/snake, 2-80 chars (a-z0-9._-)',
  })
  groupKey?: string;
}

export class CreateSlotDto {
  @IsString()
  @Matches(/^[a-z0-9_-]{2,80}$/, {
    message: 'pageKey must be lowercase kebab/snake, 2-80 chars (a-z0-9._-)',
  })
  pageKey!: string;

  @IsString()
  @Matches(/^[a-z0-9_-]{2,80}$/, {
    message: 'slotKey must be lowercase kebab/snake, 2-80 chars (a-z0-9._-)',
  })
  slotKey!: string;

  @IsString() @MaxLength(200) label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^[a-z0-9._-]{2,80}$/, {
    message: 'groupKey must be lowercase kebab/snake, 2-80 chars (a-z0-9._-)',
  })
  groupKey?: string;

  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsInt() @Min(0) specWidth?: number;
  @IsOptional() @IsInt() @Min(0) specHeight?: number;
  @IsOptional() @IsString() @MaxLength(20) specAspect?: string;
  @IsOptional() @IsInt() @Min(0) maxBytes?: number;
  @IsOptional() @IsBoolean() acceptsVideo?: boolean;
  @IsOptional() @IsString() mediaKind?: 'IMAGE' | 'VIDEO';

  // Content fields (so create + populate in one call)
  @IsOptional() @IsString() @MaxLength(500) heading?: string;
  @IsOptional() @IsString() @MaxLength(1000) subheading?: string;
  @IsOptional() @IsString() @MaxLength(20000) body?: string;
  @IsOptional() @IsString() @MaxLength(200) ctaLabel?: string;
  @IsOptional() @IsString() @MaxLength(500) ctaHref?: string;
  @IsOptional() @IsString() @MaxLength(500) altText?: string;
  @IsOptional() @IsString() @MaxLength(200) tileLabel?: string;
  @IsOptional() @IsString() @MaxLength(500) tileHref?: string;
}

export class ReorderSlotsDto {
  @IsString() groupKey!: string;
  @IsString({ each: true }) orderedSlotIds!: string[];
}
