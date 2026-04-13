import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { RedisCacheService } from 'src/common/cache/redis-cache.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AwsS3Service } from './aws-s3.service';
import { ImageRequestMode } from './dto/image-request-mode.enum';

type ImageSlot =
  | 'image1'
  | 'image2'
  | 'image3'
  | 'image4'
  | 'image5'
  | 'image6'
  | 'image7';

@Injectable()
export class ProjectsImageSharedService {
  private readonly projectContextKeyPrefix = 'project-context:';

  constructor(
    private readonly s3: AwsS3Service,
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  async getOwnedProjectContext(projectId: string, ownerId: string) {
    const cacheKey = `${this.projectContextKeyPrefix}${projectId}`;
    const cached = await this.cache.getJson<{
      ownerId: string;
      context: {
        id: string;
        name: string;
        brandName: string;
        productCategory: string;
        targetMarketplace: string;
        status: string;
        mainImage: string | null;
        sku: string | null;
        brandLogoAssetId: string | null;
        shortDescription: string | null;
        brandFontHeading: string;
        brandFontSubheading: string;
      };
    }>(cacheKey);

    if (cached) {
      if (cached.ownerId !== ownerId) {
        throw new ForbiddenException('You do not have access to this project');
      }
      return cached.context;
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ownerId: true,
        id: true,
        name: true,
        brandName: true,
        productCategory: true,
        targetMarketplace: true,
        status: true,
        mainImage: true,
        sku: true,
        brandLogoAssetId: true,
        shortDescription: true,
        brandFontHeading: true,
        brandFontSubheading: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project does not exist');
    }

    if (project.ownerId !== ownerId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const context = {
      id: project.id,
      name: project.name,
      brandName: project.brandName,
      productCategory: project.productCategory,
      targetMarketplace: project.targetMarketplace,
      status: project.status,
      mainImage: project.mainImage,
      sku: project.sku,
      brandLogoAssetId: project.brandLogoAssetId,
      shortDescription: project.shortDescription,
      brandFontHeading: project.brandFontHeading,
      brandFontSubheading: project.brandFontSubheading,
    };

    await this.cache.setJson(cacheKey, {
      ownerId: project.ownerId,
      context,
    });

    return context;
  }

  async invalidateProjectContextCache(projectId: string): Promise<void> {
    const cacheKey = `${this.projectContextKeyPrefix}${projectId}`;
    await this.cache.del(cacheKey);
  }

  requireIdempotencyKey(idempotencyKey?: string): string {
    const key = idempotencyKey?.trim();
    if (!key) {
      throw new BadRequestException(
        'idempotencyKey is required in request body',
      );
    }
    return key;
  }

  hashText(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  hashBuffer(value: Buffer): string {
    return createHash('sha256').update(value).digest('hex');
  }

  stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).sort(
        ([left], [right]) => left.localeCompare(right),
      );
      return `{${entries
        .map(
          ([key, nested]) =>
            `${JSON.stringify(key)}:${this.stableStringify(nested)}`,
        )
        .join(',')}}`;
    }

    return JSON.stringify(value);
  }

  buildGenerationId(
    slot: ImageSlot,
    mode: ImageRequestMode,
    idempotencyKey: string,
    payload: unknown,
  ): { generationId: string; keyPrefix: string } {
    const keyHash = this.hashText(`idem-key:${idempotencyKey}`).slice(0, 20);
    const payloadHash = this.hashText(
      `payload:${this.stableStringify(payload)}`,
    ).slice(0, 28);
    const keyPrefix = `${slot}:${mode}:${keyHash}:`;
    return {
      generationId: `${keyPrefix}${payloadHash}`,
      keyPrefix,
    };
  }

  throwIfKeyReusedWithDifferentPayload(
    existingGenerationId: string | null,
    requestedGenerationId: string,
  ) {
    if (
      existingGenerationId &&
      existingGenerationId !== requestedGenerationId
    ) {
      throw new ConflictException(
        'Idempotency-Key was already used with a different payload',
      );
    }
  }

  isUniqueGenerationIdError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  async resolveGeneratedImageUrl(
    imageUrl: string | undefined,
    imageBuffer: Buffer | undefined,
    imageMimeType: string | undefined,
    imageFileName: string,
    folder: string,
  ): Promise<string | undefined> {
    if (imageUrl) {
      return imageUrl;
    }

    if (!imageBuffer) {
      return undefined;
    }

    const uploadedGenerated = await this.s3.uploadBuffer({
      buffer: imageBuffer,
      mimeType: imageMimeType,
      fileName: imageFileName,
      folder,
    });

    return uploadedGenerated.url;
  }
}
