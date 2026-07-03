import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  returnsUploadPresignSchema,
  type ReturnsUploadPresignDto,
} from './dto/returns-upload-presign.dto';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsPositive,
  IsIn,
  Max,
  Min,
} from 'class-validator';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Multer } from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

class PresignedUrlDto {
  @IsString()
  @IsIn(['products', 'reviews', 'cms', 'banners', 'bundles', 'sections'])
  folder!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
  contentType!: string;

  @IsInt()
  @IsPositive()
  @Min(1)
  @Max(MAX_SIZE_BYTES)
  expectedSize!: number;
}

class DeleteFileDto {
  @IsString()
  @IsNotEmpty()
  key!: string;
}

class ProcessImageDto {
  @IsString()
  @IsNotEmpty()
  key!: string;
}

@Controller('uploads')
export class UploadsController {
  constructor(
    private uploadsService: UploadsService,
    private config: ConfigService,
  ) {}

  /**
   * Direct upload endpoint that streams the file to R2 from the server.
   * This avoids CORS issues when the browser tries to upload directly to R2.
   * The client should use this instead of the presign flow.
   */
  @Post('direct')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @UseInterceptors(FileInterceptor('file'))
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async directUpload(
    @UploadedFile() file: Multer.File,
    @Body('folder') folder: string,
    @Body('contentType') contentType: string,
  ) {
    // Validate folder
    const allowedFolders = ['products', 'reviews', 'cms', 'banners', 'bundles', 'sections'];
    if (!folder || !allowedFolders.includes(folder)) {
      throw new Error('Invalid folder');
    }

    // Validate content type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (!contentType || !allowedTypes.includes(contentType)) {
      throw new Error('Invalid content type');
    }

    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      throw new Error('File too large (max 10MB)');
    }

    // Generate key
    const ext = contentType.split('/')[1];
    const key = `${folder}/${randomUUID()}.${ext}`;

    // Get R2 client from service
    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    const bucket = this.config.get<string>('R2_BUCKET_NAME');
    const publicUrl = this.config.get<string>('R2_PUBLIC_URL') ?? '';

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error('R2 not configured');
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    // Upload to R2
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: contentType,
        ContentLength: file.size,
      }),
    );

    const publicFileUrl = `${publicUrl}/${key}`;

    return {
      key,
      publicUrl: publicFileUrl,
    };
  }

  @Post('presign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  getPresignedUrl(@Body() dto: PresignedUrlDto) {
    return this.uploadsService.getPresignedUrl(
      dto.folder,
      dto.contentType,
      dto.expectedSize,
    );
  }

  @Post('process')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  processImage(@Body() dto: ProcessImageDto) {
    return this.uploadsService.processImage(dto.key);
  }

  @Delete('file')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER, Role.SUPPORT_STAFF)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFile(@Body() dto: DeleteFileDto) {
    return this.uploadsService.deleteFile(dto.key);
  }

  /**
   * Public (no auth) presign for customer return photos. Rate-limited per
   * IP by the global ThrottlerGuard: 20 uploads / 10 minutes is enough for
   * a thorough damage report (5 photos × ~2 retries) but tight enough that
   * a scraper or storage-attacker can't burn through R2 cheaply.
   *
   * Server forces the `returns/` folder; MIME/size are validated by the
   * Zod schema AND by `presignForReturns` for defence-in-depth.
   */
  @Post('returns/presign')
  @Throttle({ default: { limit: 20, ttl: 600_000 } })
  async returnsPresign(
    @Body(new ZodValidationPipe(returnsUploadPresignSchema))
    dto: ReturnsUploadPresignDto,
  ) {
    return this.uploadsService.presignForReturns(dto);
  }
}
