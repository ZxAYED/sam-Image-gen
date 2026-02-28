import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { AiService } from 'src/ai/ai.service';
import type { UploadedFile } from 'src/common/types/uploaded-file.type';
import { PrismaService } from 'src/prisma/prisma.service';
import { sendResponse } from 'src/utils/sendResponse';
import { AwsS3Service } from './aws-s3.service';
import { CreateImage1Dto } from './dto/create-image1.dto';
import { CreateImage2Dto } from './dto/create-image2.dto';
import { CreateImage3Dto } from './dto/create-image3.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { ImageRequestMode } from './dto/image-request-mode.enum';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: AwsS3Service,
    private readonly ai: AiService,
  ) {}

  async createProject(ownerId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        ownerId,
        name: dto.name,
        brandName: dto.brandName,
        productCategory: dto.productCategory,
        targetMarketplace: dto.targetMarketplace,
        status: dto.status,
        mainImage: null,
        sku: dto.sku,
        shortDescription: dto.shortDescription,
        brandFontHeading: dto.brandFontHeading,
        brandFontSubheading: dto.brandFontSubheading,
      },
    });

    return sendResponse('Project created successfully', { project });
  }

  async createImage1ForProject(
    ownerId: string,
    dto: CreateImage1Dto,
    file?: UploadedFile,
  ) {
    const mode = dto.mode ?? ImageRequestMode.GENERATION;
    if (mode === ImageRequestMode.GENERATION) {
      return this.generateImage1(ownerId, dto, file);
    }
    return this.refineImage1(ownerId, dto);
  }

  async createImage2ForProject(ownerId: string, dto: CreateImage2Dto) {
    const mode = dto.mode;
    if (!mode) {
      throw new BadRequestException('mode is required');
    }
    if (mode === ImageRequestMode.GENERATION) {
      return this.generateImage2(ownerId, dto);
    }
    return this.refineImage2(ownerId, dto);
  }

  async createImage3ForProject(
    ownerId: string,
    dto: CreateImage3Dto,
    file?: UploadedFile,
  ) {
    const mode = dto.mode ?? ImageRequestMode.GENERATION;
    if (mode === ImageRequestMode.GENERATION) {
      return this.generateImage3(ownerId, dto, file);
    }
    return this.refineImage3(ownerId, dto);
  }

  private async generateImage1(
    ownerId: string,
    dto: CreateImage1Dto,
    file?: UploadedFile,
  ) {
    // Step 1: Validate generation input
    if (!dto.projectId) {
      throw new BadRequestException('projectId is required for generation');
    }
    if (!file) {
      throw new BadRequestException('Image file is required for generation');
    }
    const projectId = dto.projectId;
    const key = this.requireIdempotencyKey(dto.idempotencyKey);
    const idempotency = this.buildGenerationId(
      'image1',
      ImageRequestMode.GENERATION,
      key,
      {
        ownerId,
        projectId,
        style: dto.style ?? null,
        fileHash: this.hashBuffer(file.buffer),
      },
    );

    const existingImage1 = await this.prisma.image1.findFirst({
      where: { generationId: idempotency.generationId },
    });
    if (existingImage1) {
      return sendResponse(
        'Image 1 already generated for this idempotency key',
        {
          image1: existingImage1,
          idempotent: true,
        },
      );
    }

    const existingImage1ByKey = await this.prisma.image1.findFirst({
      where: {
        generationId: { startsWith: idempotency.keyPrefix },
      },
      select: { generationId: true },
    });
    this.throwIfKeyReusedWithDifferentPayload(
      existingImage1ByKey?.generationId ?? null,
      idempotency.generationId,
    );

    // Step 2: Load project and ensure ownership
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId,
      },
      select: {
        id: true,
        name: true,
        brandName: true,
        productCategory: true,
        targetMarketplace: true,
        status: true,
        sku: true,
        shortDescription: true,
        brandFontHeading: true,
        brandFontSubheading: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Step 3: Upload main image to S3
    const uploadedMainImage = await this.s3.uploadImage(file);

    // Step 4: Call Image1 generation API
    const aiResult = await this.ai.generateImage1({
      project: { ...project, mainImage: uploadedMainImage.url },
      style: dto.style,
      imageUrl: uploadedMainImage.url,
    });

    // Step 5: Resolve generated output URL (AI URL or AI binary -> S3)
    const generatedImageUrl = await this.resolveGeneratedImageUrl(
      aiResult.imageUrl,
      aiResult.imageBuffer,
      aiResult.imageMimeType,
      aiResult.imageFileName,
      'projects/generated/image1',
    );

    if (!generatedImageUrl) {
      if (aiResult.jobId || aiResult.status) {
        return sendResponse('Image 1 generation started', {
          image1: null,
          aiMeta: {
            prompt: aiResult.prompt,
            jobId: aiResult.jobId ?? null,
            status: aiResult.status ?? 'queued',
            rawResponse: aiResult.rawResponse ?? null,
          },
        });
      }
      throw new BadGatewayException(
        'AI response did not include a generated image payload',
      );
    }

    // Step 6: Persist project.mainImage + initial Image1 in one transaction
    let image1;
    try {
      image1 = await this.prisma.$transaction(async (tx) => {
        await tx.project.update({
          where: { id: projectId },
          data: { mainImage: uploadedMainImage.url },
        });

        return tx.image1.create({
          data: {
            projectId,
            versionNumber: 1,
            generatedPrompt: aiResult.prompt,
            imageUrl: generatedImageUrl,
            sourceImageUrl: uploadedMainImage.url,
            generationId: idempotency.generationId,
            status: JobStatus.SUCCEEDED,
          },
        });
      });
    } catch (error) {
      if (this.isUniqueGenerationIdError(error)) {
        const replay = await this.prisma.image1.findFirst({
          where: { generationId: idempotency.generationId },
        });
        if (replay) {
          return sendResponse(
            'Image 1 already generated for this idempotency key',
            {
              image1: replay,
              idempotent: true,
            },
          );
        }
      }

      await this.s3.deleteImage(uploadedMainImage.key);
      throw error instanceof Error
        ? error
        : new InternalServerErrorException('Failed to save image 1');
    }

    return sendResponse('Image 1 generated successfully', {
      image1,
      aiMeta: {
        jobId: aiResult.jobId ?? null,
        status: aiResult.status ?? null,
      },
    });
  }

  private async refineImage1(ownerId: string, dto: CreateImage1Dto) {
    // Step 1: Validate refine input (projectContext + feedback + previous image URL)
    const projectContext = dto.projectContext;
    const projectId =
      projectContext && typeof projectContext.id === 'string'
        ? projectContext.id
        : null;

    if (!projectContext || !projectId) {
      throw new BadRequestException(
        'projectContext with string `id` is required for refine',
      );
    }
    const projectContextPayload = projectContext as unknown as Record<
      string,
      unknown
    >;
    if (!dto.feedback?.trim()) {
      throw new BadRequestException('feedback is required for refine mode');
    }
    if (!dto.imageUrl?.trim()) {
      throw new BadRequestException(
        'imageUrl is required for refine mode (previous generated image URL)',
      );
    }
    const key = this.requireIdempotencyKey(dto.idempotencyKey);
    const idempotency = this.buildGenerationId(
      'image1',
      ImageRequestMode.REFINE,
      key,
      {
        ownerId,
        projectContext: projectContextPayload,
        style: dto.style ?? null,
        feedback: dto.feedback,
        imageUrl: dto.imageUrl,
      },
    );

    const existingImage1 = await this.prisma.image1.findFirst({
      where: { generationId: idempotency.generationId },
    });
    if (existingImage1) {
      return sendResponse('Image 1 already refined for this idempotency key', {
        image1: existingImage1,
        idempotent: true,
      });
    }

    const existingImage1ByKey = await this.prisma.image1.findFirst({
      where: {
        generationId: { startsWith: idempotency.keyPrefix },
      },
      select: { generationId: true },
    });
    this.throwIfKeyReusedWithDifferentPayload(
      existingImage1ByKey?.generationId ?? null,
      idempotency.generationId,
    );

    // Step 2: Verify project ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Step 3: Call Image1 refine API
    const aiResult = await this.ai.refineImage1({
      projectContext: projectContextPayload,
      style: dto.style,
      feedback: dto.feedback,
      imageUrl: dto.imageUrl,
    });

    // Step 4: Resolve generated output URL
    const generatedImageUrl = await this.resolveGeneratedImageUrl(
      aiResult.imageUrl,
      aiResult.imageBuffer,
      aiResult.imageMimeType,
      aiResult.imageFileName,
      'projects/generated/image1',
    );

    if (!generatedImageUrl) {
      if (aiResult.jobId || aiResult.status) {
        return sendResponse('Image 1 refine started', {
          image1: null,
          aiMeta: {
            prompt: aiResult.prompt,
            refinePrompt: aiResult.refinePrompt ?? dto.feedback,
            jobId: aiResult.jobId ?? null,
            status: aiResult.status ?? 'queued',
            rawResponse: aiResult.rawResponse ?? null,
          },
        });
      }
      throw new BadGatewayException(
        'AI response did not include a generated image payload',
      );
    }

    // Step 5: Create next Image1 version for refine in one transaction
    let image1;
    try {
      image1 = await this.prisma.$transaction(async (tx) => {
        const latestVersion = await tx.image1.findFirst({
          where: { projectId },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true },
        });

        return tx.image1.create({
          data: {
            projectId,
            versionNumber: (latestVersion?.versionNumber ?? 1) + 1,
            generatedPrompt: aiResult.prompt,
            refinePrompt: aiResult.refinePrompt ?? dto.feedback,
            imageUrl: generatedImageUrl,
            sourceImageUrl: dto.imageUrl,
            generationId: idempotency.generationId,
            status: JobStatus.SUCCEEDED,
          },
        });
      });
    } catch (error) {
      if (this.isUniqueGenerationIdError(error)) {
        const replay = await this.prisma.image1.findFirst({
          where: { generationId: idempotency.generationId },
        });
        if (replay) {
          return sendResponse(
            'Image 1 already refined for this idempotency key',
            {
              image1: replay,
              idempotent: true,
            },
          );
        }
      }
      throw error;
    }

    return sendResponse('Image 1 refined successfully', {
      image1,
      aiMeta: {
        jobId: aiResult.jobId ?? null,
        status: aiResult.status ?? null,
        refinePrompt: aiResult.refinePrompt ?? dto.feedback,
      },
    });
  }

  private async generateImage2(ownerId: string, dto: CreateImage2Dto) {
    // Step 1: Validate generation input
    if (!dto.projectId) {
      throw new BadRequestException('projectId is required for generation');
    }
    const projectId = dto.projectId;
    const key = this.requireIdempotencyKey(dto.idempotencyKey);

    const keyFacts = [dto.keyFact1, dto.keyFact2, dto.keyFact3, dto.keyFact4];
    const idempotency = this.buildGenerationId(
      'image2',
      ImageRequestMode.GENERATION,
      key,
      {
        ownerId,
        projectId,
        style: dto.style ?? null,
        keyFacts,
        backgroundStyle: dto.backgroundStyle ?? null,
        logoPosition: dto.logoPosition ?? null,
      },
    );

    const existingImage2 = await this.prisma.image2.findUnique({
      where: { generationId: idempotency.generationId },
    });
    if (existingImage2) {
      return sendResponse(
        'Image 2 already generated for this idempotency key',
        {
          image2: existingImage2,
          idempotent: true,
        },
      );
    }

    const existingImage2ByKey = await this.prisma.image2.findFirst({
      where: {
        generationId: { startsWith: idempotency.keyPrefix },
      },
      select: { generationId: true },
    });
    this.throwIfKeyReusedWithDifferentPayload(
      existingImage2ByKey?.generationId ?? null,
      idempotency.generationId,
    );

    // Step 2: Load project and ensure ownership
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId,
      },
      select: {
        id: true,
        name: true,
        brandName: true,
        productCategory: true,
        targetMarketplace: true,
        status: true,
        sku: true,
        shortDescription: true,
        brandFontHeading: true,
        brandFontSubheading: true,
        mainImage: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (!project.mainImage) {
      throw new BadRequestException(
        'Project main image is missing. Generate Image 1 first',
      );
    }

    // Step 3: Call Image2 generation API
    const aiResult = await this.ai.generateImage2({
      project,
      style: dto.style,
      keyFacts,
      backgroundStyle: dto.backgroundStyle,
      logoPosition: dto.logoPosition,
      imageUrl: project.mainImage,
    });

    // Step 4: Resolve generated output URL
    const generatedImageUrl = await this.resolveGeneratedImageUrl(
      aiResult.imageUrl,
      aiResult.imageBuffer,
      aiResult.imageMimeType,
      aiResult.imageFileName,
      'projects/generated/image2',
    );

    if (!generatedImageUrl) {
      if (aiResult.jobId || aiResult.status) {
        return sendResponse('Image 2 generation started', {
          image2: null,
          aiMeta: {
            prompt: aiResult.prompt,
            jobId: aiResult.jobId ?? null,
            status: aiResult.status ?? 'queued',
            rawResponse: aiResult.rawResponse ?? null,
          },
        });
      }
      throw new BadGatewayException(
        'AI response did not include a generated image payload',
      );
    }

    // Step 5: Persist initial Image2 row in one transaction
    let image2;
    try {
      image2 = await this.prisma.$transaction((tx) =>
        tx.image2.create({
          data: {
            projectId,
            versionNumber: 1,
            generatedPrompt: aiResult.prompt,
            imageUrl: generatedImageUrl,
            generationId: idempotency.generationId,
            status: JobStatus.SUCCEEDED,
            backgroundStyle: dto.backgroundStyle ?? null,
            brandLogoPosition: dto.logoPosition ?? null,
            keyFact1: dto.keyFact1,
            keyFact2: dto.keyFact2,
            keyFact3: dto.keyFact3,
            keyFact4: dto.keyFact4,
          },
        }),
      );
    } catch (error) {
      if (this.isUniqueGenerationIdError(error)) {
        const replay = await this.prisma.image2.findUnique({
          where: { generationId: idempotency.generationId },
        });
        if (replay) {
          return sendResponse(
            'Image 2 already generated for this idempotency key',
            {
              image2: replay,
              idempotent: true,
            },
          );
        }
      }
      throw error;
    }

    return sendResponse('Image 2 generated successfully', {
      image2,
      aiMeta: {
        jobId: aiResult.jobId ?? null,
        status: aiResult.status ?? null,
      },
    });
  }

  private async refineImage2(ownerId: string, dto: CreateImage2Dto) {
    // Step 1: Validate refine input (projectContext + feedback + key facts)
    const projectContext = dto.projectContext;
    const projectId =
      projectContext && typeof projectContext.id === 'string'
        ? projectContext.id
        : null;

    if (!projectContext || !projectId) {
      throw new BadRequestException(
        'projectContext with string `id` is required for refine',
      );
    }
    const projectContextPayload = projectContext as unknown as Record<
      string,
      unknown
    >;

    const keyFacts = [dto.keyFact1, dto.keyFact2, dto.keyFact3, dto.keyFact4];
    const key = this.requireIdempotencyKey(dto.idempotencyKey);

    if (!dto.feedback?.trim()) {
      throw new BadRequestException('feedback is required for refine mode');
    }
    const idempotency = this.buildGenerationId(
      'image2',
      ImageRequestMode.REFINE,
      key,
      {
        ownerId,
        projectContext: projectContextPayload,
        style: dto.style ?? null,
        feedback: dto.feedback,
        keyFacts,
        backgroundStyle: dto.backgroundStyle ?? null,
        logoPosition: dto.logoPosition ?? null,
        imageUrl: dto.imageUrl ?? null,
      },
    );

    const existingImage2 = await this.prisma.image2.findUnique({
      where: { generationId: idempotency.generationId },
    });
    if (existingImage2) {
      return sendResponse('Image 2 already refined for this idempotency key', {
        image2: existingImage2,
        idempotent: true,
      });
    }

    const existingImage2ByKey = await this.prisma.image2.findFirst({
      where: {
        generationId: { startsWith: idempotency.keyPrefix },
      },
      select: { generationId: true },
    });
    this.throwIfKeyReusedWithDifferentPayload(
      existingImage2ByKey?.generationId ?? null,
      idempotency.generationId,
    );

    // Step 2: Verify project ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Step 3: Call Image2 refine API
    const aiResult = await this.ai.refineImage2({
      projectContext: projectContextPayload,
      style: dto.style,
      feedback: dto.feedback,
      keyFacts,
      backgroundStyle: dto.backgroundStyle,
      logoPosition: dto.logoPosition,
      imageUrl: dto.imageUrl,
    });

    // Step 4: Resolve generated output URL
    const generatedImageUrl = await this.resolveGeneratedImageUrl(
      aiResult.imageUrl,
      aiResult.imageBuffer,
      aiResult.imageMimeType,
      aiResult.imageFileName,
      'projects/generated/image2',
    );

    if (!generatedImageUrl) {
      if (aiResult.jobId || aiResult.status) {
        return sendResponse('Image 2 refine started', {
          image2: null,
          aiMeta: {
            prompt: aiResult.prompt,
            refinePrompt: aiResult.refinePrompt ?? dto.feedback,
            jobId: aiResult.jobId ?? null,
            status: aiResult.status ?? 'queued',
            rawResponse: aiResult.rawResponse ?? null,
          },
        });
      }
      throw new BadGatewayException(
        'AI response did not include a generated image payload',
      );
    }

    // Step 5: Create next Image2 version in one transaction
    let image2;
    try {
      image2 = await this.prisma.$transaction(async (tx) => {
        const latestVersion = await tx.image2.findFirst({
          where: { projectId },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true },
        });

        return tx.image2.create({
          data: {
            projectId,
            versionNumber: (latestVersion?.versionNumber ?? 1) + 1,
            generatedPrompt: aiResult.prompt,
            refinePrompt: aiResult.refinePrompt ?? dto.feedback,
            imageUrl: generatedImageUrl,
            generationId: idempotency.generationId,
            status: JobStatus.SUCCEEDED,
            backgroundStyle: dto.backgroundStyle ?? null,
            brandLogoPosition: dto.logoPosition ?? null,
            keyFact1: dto.keyFact1,
            keyFact2: dto.keyFact2,
            keyFact3: dto.keyFact3,
            keyFact4: dto.keyFact4,
          },
        });
      });
    } catch (error) {
      if (this.isUniqueGenerationIdError(error)) {
        const replay = await this.prisma.image2.findUnique({
          where: { generationId: idempotency.generationId },
        });
        if (replay) {
          return sendResponse(
            'Image 2 already refined for this idempotency key',
            {
              image2: replay,
              idempotent: true,
            },
          );
        }
      }
      throw error;
    }

    return sendResponse('Image 2 refined successfully', {
      image2,
      aiMeta: {
        jobId: aiResult.jobId ?? null,
        status: aiResult.status ?? null,
        refinePrompt: aiResult.refinePrompt ?? dto.feedback,
      },
    });
  }

  private async generateImage3(
    ownerId: string,
    dto: CreateImage3Dto,
    file?: UploadedFile,
  ) {
    // Step 1: Validate generation input
    if (!dto.projectId) {
      throw new BadRequestException('projectId is required for generation');
    }
    if (!file) {
      throw new BadRequestException(
        'Lifestyle image file is required for generation',
      );
    }
    const projectId = dto.projectId;
    const key = this.requireIdempotencyKey(dto.idempotencyKey);
    const idempotency = this.buildGenerationId(
      'image3',
      ImageRequestMode.GENERATION,
      key,
      {
        ownerId,
        projectId,
        style: dto.style ?? null,
        scenario: dto.scenario ?? null,
        fileHash: this.hashBuffer(file.buffer),
      },
    );

    const existingImage3 = await this.prisma.image3.findUnique({
      where: { generationId: idempotency.generationId },
    });
    if (existingImage3) {
      return sendResponse(
        'Image 3 already generated for this idempotency key',
        {
          image3: existingImage3,
          idempotent: true,
        },
      );
    }

    const existingImage3ByKey = await this.prisma.image3.findFirst({
      where: {
        generationId: { startsWith: idempotency.keyPrefix },
      },
      select: { generationId: true },
    });
    this.throwIfKeyReusedWithDifferentPayload(
      existingImage3ByKey?.generationId ?? null,
      idempotency.generationId,
    );

    // Step 2: Load project and ensure ownership
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId,
      },
      select: {
        id: true,
        name: true,
        brandName: true,
        productCategory: true,
        targetMarketplace: true,
        status: true,
        mainImage: true,
        sku: true,
        shortDescription: true,
        brandFontHeading: true,
        brandFontSubheading: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Step 3: Upload lifestyle reference image to S3
    const uploadedRefImage = await this.s3.uploadBuffer({
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname,
      folder: 'projects/lifestyle-refs',
    });

    // Step 4: Call Image3 generation API
    const aiResult = await this.ai.generateImage3({
      project,
      style: dto.style,
      scenario: dto.scenario,
      refImageUrl: uploadedRefImage.url,
    });

    // Step 5: Resolve generated output URL (AI URL or AI binary -> S3)
    const generatedImageUrl = await this.resolveGeneratedImageUrl(
      aiResult.imageUrl,
      aiResult.imageBuffer,
      aiResult.imageMimeType,
      aiResult.imageFileName,
      'projects/generated/image3',
    );

    if (!generatedImageUrl) {
      if (aiResult.jobId || aiResult.status) {
        return sendResponse('Image 3 generation started', {
          image3: null,
          aiMeta: {
            prompt: aiResult.prompt,
            jobId: aiResult.jobId ?? null,
            status: aiResult.status ?? 'queued',
            rawResponse: aiResult.rawResponse ?? null,
          },
        });
      }
      throw new BadGatewayException(
        'AI response did not include a generated image payload',
      );
    }

    // Step 6: Persist initial Image3 row in one transaction
    let image3;
    try {
      image3 = await this.prisma.$transaction((tx) =>
        tx.image3.create({
          data: {
            projectId,
            versionNumber: 1,
            generatedPrompt: aiResult.prompt,
            imageUrl: generatedImageUrl,
            generationId: idempotency.generationId,
            status: JobStatus.SUCCEEDED,
            usageScenarioDescription: dto.scenario ?? null,
            lifestyleProviderImage: uploadedRefImage.url,
            lifestyleGeneratedImage: generatedImageUrl,
          },
        }),
      );
    } catch (error) {
      if (this.isUniqueGenerationIdError(error)) {
        const replay = await this.prisma.image3.findUnique({
          where: { generationId: idempotency.generationId },
        });
        if (replay) {
          return sendResponse(
            'Image 3 already generated for this idempotency key',
            {
              image3: replay,
              idempotent: true,
            },
          );
        }
      }
      throw error;
    }

    return sendResponse('Image 3 generated successfully', {
      image3,
      aiMeta: {
        jobId: aiResult.jobId ?? null,
        status: aiResult.status ?? null,
      },
    });
  }

  private async refineImage3(ownerId: string, dto: CreateImage3Dto) {
    // Step 1: Validate refine input (projectContext + feedback + ref image url)
    const projectContext = dto.projectContext;
    const projectId =
      projectContext && typeof projectContext.id === 'string'
        ? projectContext.id
        : null;

    if (!projectContext || !projectId) {
      throw new BadRequestException(
        'projectContext with string `id` is required for refine',
      );
    }
    const projectContextPayload = projectContext as unknown as Record<
      string,
      unknown
    >;
    if (!dto.feedback?.trim()) {
      throw new BadRequestException('feedback is required for refine mode');
    }
    if (!dto.refImageUrl?.trim()) {
      throw new BadRequestException(
        'refImageUrl is required for refine mode (previous image URL)',
      );
    }
    const key = this.requireIdempotencyKey(dto.idempotencyKey);
    const idempotency = this.buildGenerationId(
      'image3',
      ImageRequestMode.REFINE,
      key,
      {
        ownerId,
        projectContext: projectContextPayload,
        style: dto.style ?? null,
        feedback: dto.feedback,
        scenario: dto.scenario ?? null,
        refImageUrl: dto.refImageUrl,
      },
    );

    const existingImage3 = await this.prisma.image3.findUnique({
      where: { generationId: idempotency.generationId },
    });
    if (existingImage3) {
      return sendResponse('Image 3 already refined for this idempotency key', {
        image3: existingImage3,
        idempotent: true,
      });
    }

    const existingImage3ByKey = await this.prisma.image3.findFirst({
      where: {
        generationId: { startsWith: idempotency.keyPrefix },
      },
      select: { generationId: true },
    });
    this.throwIfKeyReusedWithDifferentPayload(
      existingImage3ByKey?.generationId ?? null,
      idempotency.generationId,
    );

    // Step 2: Verify project ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Step 3: Call Image3 refine API
    const aiResult = await this.ai.refineImage3({
      projectContext: projectContextPayload,
      style: dto.style,
      feedback: dto.feedback,
      scenario: dto.scenario,
      refImageUrl: dto.refImageUrl,
    });

    // Step 4: Resolve generated output URL
    const generatedImageUrl = await this.resolveGeneratedImageUrl(
      aiResult.imageUrl,
      aiResult.imageBuffer,
      aiResult.imageMimeType,
      aiResult.imageFileName,
      'projects/generated/image3',
    );

    if (!generatedImageUrl) {
      if (aiResult.jobId || aiResult.status) {
        return sendResponse('Image 3 refine started', {
          image3: null,
          aiMeta: {
            prompt: aiResult.prompt,
            refinePrompt: aiResult.refinePrompt ?? dto.feedback,
            jobId: aiResult.jobId ?? null,
            status: aiResult.status ?? 'queued',
            rawResponse: aiResult.rawResponse ?? null,
          },
        });
      }
      throw new BadGatewayException(
        'AI response did not include a generated image payload',
      );
    }

    // Step 5: Create next Image3 version in one transaction
    let image3;
    try {
      image3 = await this.prisma.$transaction(async (tx) => {
        const latestVersion = await tx.image3.findFirst({
          where: { projectId },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true },
        });

        return tx.image3.create({
          data: {
            projectId,
            versionNumber: (latestVersion?.versionNumber ?? 1) + 1,
            generatedPrompt: aiResult.prompt,
            refinePrompt: aiResult.refinePrompt ?? dto.feedback,
            imageUrl: generatedImageUrl,
            generationId: idempotency.generationId,
            status: JobStatus.SUCCEEDED,
            usageScenarioDescription: dto.scenario ?? null,
            lifestyleProviderImage: dto.refImageUrl,
            lifestyleGeneratedImage: generatedImageUrl,
          },
        });
      });
    } catch (error) {
      if (this.isUniqueGenerationIdError(error)) {
        const replay = await this.prisma.image3.findUnique({
          where: { generationId: idempotency.generationId },
        });
        if (replay) {
          return sendResponse(
            'Image 3 already refined for this idempotency key',
            {
              image3: replay,
              idempotent: true,
            },
          );
        }
      }
      throw error;
    }

    return sendResponse('Image 3 refined successfully', {
      image3,
      aiMeta: {
        jobId: aiResult.jobId ?? null,
        status: aiResult.status ?? null,
        refinePrompt: aiResult.refinePrompt ?? dto.feedback,
      },
    });
  }

  private requireIdempotencyKey(idempotencyKey?: string): string {
    const key = idempotencyKey?.trim();
    if (!key) {
      throw new BadRequestException(
        'idempotencyKey is required in request body',
      );
    }
    return key;
  }

  private hashText(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private hashBuffer(value: Buffer): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private stableStringify(value: unknown): string {
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

  private buildGenerationId(
    slot: 'image1' | 'image2' | 'image3',
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

  private throwIfKeyReusedWithDifferentPayload(
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

  private isUniqueGenerationIdError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private async resolveGeneratedImageUrl(
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
