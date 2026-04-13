import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImageSlotType, JobStatus, OptimizationAction } from '@prisma/client';
import { AiService } from 'src/ai/ai.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { sendResponse } from 'src/utils/sendResponse';
import { CreateImage4Dto } from './dto/create-image4.dto';
import { CreateImage5Dto } from './dto/create-image5.dto';
import { CreateImage6Dto } from './dto/create-image6.dto';
import { CreateImage7Dto } from './dto/create-image7.dto';
import { ImageRequestMode } from './dto/image-request-mode.enum';
import { ProjectsImageSharedService } from './projects-image-shared.service';

@Injectable()
export class ProjectsImage4To7Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly imageShared: ProjectsImageSharedService,
  ) { }

  private async createOptimizationAudit(input: {
    projectId: string;
    slot: ImageSlotType;
    action: OptimizationAction;
    imageRecordId?: string;
    versionNumber?: number;
    prompt?: string | null;
    refinePrompt?: string | null;
    imageUrl?: string | null;
  }) {
    await this.prisma.optimizationAudit.create({
      data: {
        projectId: input.projectId,
        slot: input.slot,
        action: input.action,
        imageRecordId: input.imageRecordId,
        versionNumber: input.versionNumber,
        prompt: input.prompt ?? null,
        refinePrompt: input.refinePrompt ?? null,
        imageUrl: input.imageUrl ?? null,
      },
    });
  }

  async createImage4ForProject(ownerId: string, dto: CreateImage4Dto) {
    const mode = dto.mode;
    if (!mode) {
      throw new BadRequestException('mode is required');
    }
    if (mode === ImageRequestMode.GENERATION) {
      return this.generateImage4(ownerId, dto);
    }
    return this.refineImage4(ownerId, dto);
  }

  async createImage5ForProject(ownerId: string, dto: CreateImage5Dto) {
    const mode = dto.mode ?? ImageRequestMode.GENERATION;
    if (mode === ImageRequestMode.GENERATION) {
      return this.generateImage5(ownerId, dto);
    }
    return this.refineImage5(ownerId, dto);
  }

  async createImage6ForProject(ownerId: string, dto: CreateImage6Dto) {
    const mode = dto.mode ?? ImageRequestMode.GENERATION;
    if (mode === ImageRequestMode.GENERATION) {
      return this.generateImage6(ownerId, dto);
    }
    return this.refineImage6(ownerId, dto);
  }

  async createImage7ForProject(ownerId: string, dto: CreateImage7Dto) {
    const mode = dto.mode ?? ImageRequestMode.GENERATION;
    if (mode === ImageRequestMode.GENERATION) {
      return this.generateImage7(ownerId, dto);
    }
    return this.refineImage7(ownerId, dto);
  }

  private async generateImage4(ownerId: string, dto: CreateImage4Dto) {
    // Step 1: Validate generation input
    if (!dto.projectId) {
      throw new BadRequestException('projectId is required for generation');
    }
    const projectId = dto.projectId;
    if (!dto.usps?.length) {
      throw new BadRequestException('usps are required for generation');
    }
    const key = this.imageShared.requireIdempotencyKey(dto.idempotencyKey);
    const idempotency = this.imageShared.buildGenerationId(
      'image4',
      ImageRequestMode.GENERATION,
      key,
      {
        ownerId,
        projectId,
        style: dto.style ?? null,
        usps: dto.usps,
      },
    );

    const existingImage4 = await this.prisma.image4.findUnique({
      where: { generationId: idempotency.generationId },
    });
    if (existingImage4) {
      return sendResponse(
        'Image 4 already generated for this idempotency key',
        {
          image4: existingImage4,
          idempotent: true,
        },
      );
    }

    const existingImage4ByKey = await this.prisma.image4.findFirst({
      where: {
        generationId: { startsWith: idempotency.keyPrefix },
      },
      select: { generationId: true },
    });
    this.imageShared.throwIfKeyReusedWithDifferentPayload(
      existingImage4ByKey?.generationId ?? null,
      idempotency.generationId,
    );

    // Step 2: Load project and ensure ownership
    const project = await this.imageShared.getOwnedProjectContext(
      projectId,
      ownerId,
    );
    console.log(
      '🚀 ~ ProjectsImage4To7Service ~ generateImage4 ~ project:',
      project,
    );

    // Step 3: Call Image4 generation API
    const aiResult = await this.ai.generateImage4({
      projectContext: project,
      style: dto.style,
      usps: dto.usps,
    });
    console.log(
      '🚀 ~ ProjectsImage4To7Service ~ generateImage4 ~ aiResult:',
      aiResult,
    );

    // Step 4: Resolve generated output URL
    const generatedImageUrl = await this.imageShared.resolveGeneratedImageUrl(
      aiResult.imageUrl,
      aiResult.imageBuffer,
      aiResult.imageMimeType,
      aiResult.imageFileName,
      'projects/generated/image4',
    );

    if (!generatedImageUrl) {
      if (aiResult.jobId || aiResult.status) {
        return sendResponse('Image 4 generation started', {
          image4: null,
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

    // Step 5: Persist initial Image4 row in one transaction
    let image4;
    try {
      image4 = await this.prisma.$transaction((tx) =>
        tx.image4.create({
          data: {
            projectId,
            versionNumber: 1,
            generatedPrompt: aiResult.prompt,
            imageUrl: generatedImageUrl,
            generationId: idempotency.generationId,
            status: JobStatus.SUCCEEDED,
            uspHighlight1: dto.usps[0] ?? null,
            uspHighlight2: dto.usps[1] ?? null,
            uspHighlight3: dto.usps[2] ?? null,
            uspHighlight4: dto.usps[3] ?? null,
          },
        }),
      );
    } catch (error) {
      if (this.imageShared.isUniqueGenerationIdError(error)) {
        const replay = await this.prisma.image4.findUnique({
          where: { generationId: idempotency.generationId },
        });
        if (replay) {
          return sendResponse(
            'Image 4 already generated for this idempotency key',
            {
              image4: replay,
              idempotent: true,
            },
          );
        }
      }
      throw error;
    }

    await this.createOptimizationAudit({
      projectId,
      slot: ImageSlotType.USP_HIGHLIGHT,
      action: OptimizationAction.GENERATION,
      imageRecordId: image4.id,
      versionNumber: image4.versionNumber,
      prompt: image4.generatedPrompt,
      refinePrompt: image4.refinePrompt,
      imageUrl: image4.imageUrl,
    });

    return sendResponse('Image 4 generated successfully', {
      image4,
      aiMeta: {
        jobId: aiResult.jobId ?? null,
        status: aiResult.status ?? null,
      },
    });
  }

  private async refineImage4(ownerId: string, dto: CreateImage4Dto) {
    // Step 1: Validate refine input (projectId + feedback + usps)
    if (!dto.projectId) {
      throw new BadRequestException('projectId is required for refine mode');
    }
    if (!dto.feedback?.trim()) {
      throw new BadRequestException('feedback is required for refine mode');
    }
    if (!dto.usps?.length) {
      throw new BadRequestException('usps are required for refine mode');
    }
    const projectId = dto.projectId;

    const key = this.imageShared.requireIdempotencyKey(dto.idempotencyKey);
    const idempotency = this.imageShared.buildGenerationId(
      'image4',
      ImageRequestMode.REFINE,
      key,
      {
        ownerId,
        projectId,
        style: dto.style ?? null,
        feedback: dto.feedback,
        usps: dto.usps,
      },
    );

    const existingImage4 = await this.prisma.image4.findUnique({
      where: { generationId: idempotency.generationId },
    });
    if (existingImage4) {
      return sendResponse('Image 4 already refined for this idempotency key', {
        image4: existingImage4,
        idempotent: true,
      });
    }

    const existingImage4ByKey = await this.prisma.image4.findFirst({
      where: {
        generationId: { startsWith: idempotency.keyPrefix },
      },
      select: { generationId: true },
    });
    this.imageShared.throwIfKeyReusedWithDifferentPayload(
      existingImage4ByKey?.generationId ?? null,
      idempotency.generationId,
    );

    // Step 2: Verify project ownership and fetch DB context
    const project = await this.imageShared.getOwnedProjectContext(
      projectId,
      ownerId,
    );

    const image4Source = await this.prisma.image4.findFirst({
      where: { projectId },
      orderBy: [{ versionNumber: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    if (!image4Source) {
      throw new NotFoundException(
        'No generated Image 4 found for this project to refine',
      );
    }
    const projectContextPayload = project as unknown as Record<string, unknown>;

    // Step 3: Call Image4 refine API
    const aiResult = await this.ai.refineImage4({
      projectContext: projectContextPayload,
      style: dto.style,
      feedback: dto.feedback,
      usps: dto.usps,
    });

    // Step 4: Resolve generated output URL
    const generatedImageUrl = await this.imageShared.resolveGeneratedImageUrl(
      aiResult.imageUrl,
      aiResult.imageBuffer,
      aiResult.imageMimeType,
      aiResult.imageFileName,
      'projects/generated/image4',
    );

    if (!generatedImageUrl) {
      if (aiResult.jobId || aiResult.status) {
        return sendResponse('Image 4 refine started', {
          image4: null,
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

    // Step 5: Create next Image4 version in one transaction
    let image4;
    try {
      image4 = await this.prisma.$transaction(async (tx) => {
        const latestVersion = await tx.image4.findFirst({
          where: { projectId },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true },
        });

        return tx.image4.create({
          data: {
            projectId,
            versionNumber: (latestVersion?.versionNumber ?? 1) + 1,
            generatedPrompt: aiResult.prompt,
            refinePrompt: aiResult.refinePrompt ?? dto.feedback,
            imageUrl: generatedImageUrl,
            generationId: idempotency.generationId,
            status: JobStatus.SUCCEEDED,
            uspHighlight1: dto.usps[0] ?? null,
            uspHighlight2: dto.usps[1] ?? null,
            uspHighlight3: dto.usps[2] ?? null,
            uspHighlight4: dto.usps[3] ?? null,
          },
        });
      });
    } catch (error) {
      if (this.imageShared.isUniqueGenerationIdError(error)) {
        const replay = await this.prisma.image4.findUnique({
          where: { generationId: idempotency.generationId },
        });
        if (replay) {
          return sendResponse(
            'Image 4 already refined for this idempotency key',
            {
              image4: replay,
              idempotent: true,
            },
          );
        }
      }
      throw error;
    }

    await this.createOptimizationAudit({
      projectId,
      slot: ImageSlotType.USP_HIGHLIGHT,
      action: OptimizationAction.REFINE,
      imageRecordId: image4.id,
      versionNumber: image4.versionNumber,
      prompt: image4.generatedPrompt,
      refinePrompt: image4.refinePrompt,
      imageUrl: image4.imageUrl,
    });

    return sendResponse('Image 4 refined successfully', {
      image4,
      aiMeta: {
        jobId: aiResult.jobId ?? null,
        status: aiResult.status ?? null,
        refinePrompt: aiResult.refinePrompt ?? dto.feedback,
      },
    });
  }

  private async generateImage5(ownerId: string, dto: CreateImage5Dto) {
    // Step 1: Validate generation input
    if (!dto.projectId) {
      throw new BadRequestException('projectId is required for generation');
    }
    const projectId = dto.projectId;
    if (!dto.advantages?.length) {
      throw new BadRequestException('advantages are required for generation');
    }
    if (!dto.limitations?.length) {
      throw new BadRequestException('limitations are required for generation');
    }
    const key = this.imageShared.requireIdempotencyKey(dto.idempotencyKey);
    const idempotency = this.imageShared.buildGenerationId(
      'image5',
      ImageRequestMode.GENERATION,
      key,
      {
        ownerId,
        projectId,
        style: dto.style ?? null,
        advantages: dto.advantages,
        limitations: dto.limitations,
      },
    );

    const existingImage5 = await this.prisma.image5.findUnique({
      where: { generationId: idempotency.generationId },
    });
    if (existingImage5) {
      return sendResponse(
        'Image 5 already generated for this idempotency key',
        {
          image5: existingImage5,
          idempotent: true,
        },
      );
    }

    const existingImage5ByKey = await this.prisma.image5.findFirst({
      where: {
        generationId: { startsWith: idempotency.keyPrefix },
      },
      select: { generationId: true },
    });
    this.imageShared.throwIfKeyReusedWithDifferentPayload(
      existingImage5ByKey?.generationId ?? null,
      idempotency.generationId,
    );

    // Step 2: Verify project ownership
    const project = await this.imageShared.getOwnedProjectContext(
      projectId,
      ownerId,
    );

    // Step 3: Call Image5 generation API
    const aiResult = await this.ai.generateImage5({
      projectContext: project,
      style: dto.style,
      advantages: dto.advantages,
      limitations: dto.limitations,
    });

    // Step 4: Resolve generated output URL upload to s3
    const generatedImageUrl = await this.imageShared.resolveGeneratedImageUrl(
      aiResult.imageUrl,
      aiResult.imageBuffer,
      aiResult.imageMimeType,
      aiResult.imageFileName,
      'projects/generated/image5',
    );

    if (!generatedImageUrl) {
      if (aiResult.jobId || aiResult.status) {
        return sendResponse('Image 5 generation started', {
          image5: null,
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

    // Step 5: Persist initial Image5 row in one transaction
    let image5;
    try {
      image5 = await this.prisma.$transaction((tx) =>
        tx.image5.create({
          data: {
            projectId,
            versionNumber: 1,
            generatedPrompt: aiResult.prompt,
            imageUrl: generatedImageUrl,
            generationId: idempotency.generationId,
            status: JobStatus.SUCCEEDED,
            comparisonAdv1: dto.advantages[0] ?? null,
            comparisonAdv2: dto.advantages[1] ?? null,
            comparisonAdv3: dto.advantages[2] ?? null,
            comparisonLim1: dto.limitations[0] ?? null,
            comparisonLim2: dto.limitations[1] ?? null,
            comparisonLim3: dto.limitations[2] ?? null,
          },
        }),
      );
    } catch (error) {
      if (this.imageShared.isUniqueGenerationIdError(error)) {
        const replay = await this.prisma.image5.findUnique({
          where: { generationId: idempotency.generationId },
        });
        if (replay) {
          return sendResponse(
            'Image 5 already generated for this idempotency key',
            {
              image5: replay,
              idempotent: true,
            },
          );
        }
      }
      throw error;
    }

    await this.createOptimizationAudit({
      projectId,
      slot: ImageSlotType.COMPARISON,
      action: OptimizationAction.GENERATION,
      imageRecordId: image5.id,
      versionNumber: image5.versionNumber,
      prompt: image5.generatedPrompt,
      refinePrompt: image5.refinePrompt,
      imageUrl: image5.imageUrl,
    });

    return sendResponse('Image 5 generated successfully', {
      image5,
      aiMeta: {
        jobId: aiResult.jobId ?? null,
        status: aiResult.status ?? null,
      },
    });
  }

  private async refineImage5(ownerId: string, dto: CreateImage5Dto) {
    // Step 1: Validate refine input (projectId + feedback + comparison arrays)
    if (!dto.projectId) {
      throw new BadRequestException('projectId is required for refine mode');
    }
    if (!dto.feedback?.trim()) {
      throw new BadRequestException('feedback is required for refine mode');
    }
    if (!dto.advantages?.length) {
      throw new BadRequestException('advantages are required for refine mode');
    }
    if (!dto.limitations?.length) {
      throw new BadRequestException('limitations are required for refine mode');
    }
    const projectId = dto.projectId;

    const key = this.imageShared.requireIdempotencyKey(dto.idempotencyKey);
    const idempotency = this.imageShared.buildGenerationId(
      'image5',
      ImageRequestMode.REFINE,
      key,
      {
        ownerId,
        projectId,
        style: dto.style ?? null,
        feedback: dto.feedback,
        advantages: dto.advantages,
        limitations: dto.limitations,
      },
    );

    const existingImage5 = await this.prisma.image5.findUnique({
      where: { generationId: idempotency.generationId },
    });
    if (existingImage5) {
      return sendResponse('Image 5 already refined for this idempotency key', {
        image5: existingImage5,
        idempotent: true,
      });
    }

    const existingImage5ByKey = await this.prisma.image5.findFirst({
      where: {
        generationId: { startsWith: idempotency.keyPrefix },
      },
      select: { generationId: true },
    });
    this.imageShared.throwIfKeyReusedWithDifferentPayload(
      existingImage5ByKey?.generationId ?? null,
      idempotency.generationId,
    );

    // Step 2: Verify project ownership and fetch DB context
    const project = await this.imageShared.getOwnedProjectContext(
      projectId,
      ownerId,
    );

    const image5Source = await this.prisma.image5.findFirst({
      where: { projectId },
      orderBy: [{ versionNumber: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    if (!image5Source) {
      throw new NotFoundException(
        'No generated Image 5 found for this project to refine',
      );
    }
    const projectContextPayload = project as unknown as Record<string, unknown>;

    // Step 3: Call Image5 refine API
    const aiResult = await this.ai.refineImage5({
      projectContext: projectContextPayload,
      style: dto.style,
      feedback: dto.feedback,
      advantages: dto.advantages,
      limitations: dto.limitations,
    });

    // Step 4: Resolve generated output URL
    const generatedImageUrl = await this.imageShared.resolveGeneratedImageUrl(
      aiResult.imageUrl,
      aiResult.imageBuffer,
      aiResult.imageMimeType,
      aiResult.imageFileName,
      'projects/generated/image5',
    );

    if (!generatedImageUrl) {
      if (aiResult.jobId || aiResult.status) {
        return sendResponse('Image 5 refine started', {
          image5: null,
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

    // Step 5: Create next Image5 version in one transaction
    let image5;
    try {
      image5 = await this.prisma.$transaction(async (tx) => {
        const latestVersion = await tx.image5.findFirst({
          where: { projectId },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true },
        });

        return tx.image5.create({
          data: {
            projectId,
            versionNumber: (latestVersion?.versionNumber ?? 1) + 1,
            generatedPrompt: aiResult.prompt,
            refinePrompt: aiResult.refinePrompt ?? dto.feedback,
            imageUrl: generatedImageUrl,
            generationId: idempotency.generationId,
            status: JobStatus.SUCCEEDED,
            comparisonAdv1: dto.advantages[0] ?? null,
            comparisonAdv2: dto.advantages[1] ?? null,
            comparisonAdv3: dto.advantages[2] ?? null,
            comparisonLim1: dto.limitations[0] ?? null,
            comparisonLim2: dto.limitations[1] ?? null,
            comparisonLim3: dto.limitations[2] ?? null,
          },
        });
      });
    } catch (error) {
      if (this.imageShared.isUniqueGenerationIdError(error)) {
        const replay = await this.prisma.image5.findUnique({
          where: { generationId: idempotency.generationId },
        });
        if (replay) {
          return sendResponse(
            'Image 5 already refined for this idempotency key',
            {
              image5: replay,
              idempotent: true,
            },
          );
        }
      }
      throw error;
    }

    await this.createOptimizationAudit({
      projectId,
      slot: ImageSlotType.COMPARISON,
      action: OptimizationAction.REFINE,
      imageRecordId: image5.id,
      versionNumber: image5.versionNumber,
      prompt: image5.generatedPrompt,
      refinePrompt: image5.refinePrompt,
      imageUrl: image5.imageUrl,
    });

    return sendResponse('Image 5 refined successfully', {
      image5,
      aiMeta: {
        jobId: aiResult.jobId ?? null,
        status: aiResult.status ?? null,
        refinePrompt: aiResult.refinePrompt ?? dto.feedback,
      },
    });
  }

  private async generateImage6(ownerId: string, dto: CreateImage6Dto) {
    // Step 1: Validate generation input
    if (!dto.projectId) {
      throw new BadRequestException('projectId is required for generation');
    }
    const projectId = dto.projectId;
    if (!dto.productNames?.length) {
      throw new BadRequestException('productNames are required for generation');
    }
    const key = this.imageShared.requireIdempotencyKey(dto.idempotencyKey);
    const idempotency = this.imageShared.buildGenerationId(
      'image6',
      ImageRequestMode.GENERATION,
      key,
      {
        ownerId,
        projectId,
        style: dto.style ?? null,
        productNames: dto.productNames,
      },
    );

    const existingImage6 = await this.prisma.image6.findUnique({
      where: { generationId: idempotency.generationId },
    });
    if (existingImage6) {
      return sendResponse(
        'Image 6 already generated for this idempotency key',
        {
          image6: existingImage6,
          idempotent: true,
        },
      );
    }

    const existingImage6ByKey = await this.prisma.image6.findFirst({
      where: {
        generationId: { startsWith: idempotency.keyPrefix },
      },
      select: { generationId: true },
    });
    this.imageShared.throwIfKeyReusedWithDifferentPayload(
      existingImage6ByKey?.generationId ?? null,
      idempotency.generationId,
    );

    // Step 2: Verify project ownership and fetch DB context
    const project = await this.imageShared.getOwnedProjectContext(
      projectId,
      ownerId,
    );

    // Step 3: Call Image6 generation API
    const aiResult = await this.ai.generateImage6({
      projectContext: project,
      style: dto.style,
      productNames: dto.productNames,
    });

    // Step 4: Resolve generated output URL
    const generatedImageUrl = await this.imageShared.resolveGeneratedImageUrl(
      aiResult.imageUrl,
      aiResult.imageBuffer,
      aiResult.imageMimeType,
      aiResult.imageFileName,
      'projects/generated/image6',
    );

    if (!generatedImageUrl) {
      if (aiResult.jobId || aiResult.status) {
        return sendResponse('Image 6 generation started', {
          image6: null,
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

    // Step 5: Persist initial Image6 row in one transaction
    let image6;
    try {
      image6 = await this.prisma.$transaction((tx) =>
        tx.image6.create({
          data: {
            projectId,
            versionNumber: 1,
            generatedPrompt: aiResult.prompt,
            imageUrl: generatedImageUrl,
            generationId: idempotency.generationId,
            status: JobStatus.SUCCEEDED,
            crossSellProduct1: dto.productNames[0] ?? null,
            crossSellProduct2: dto.productNames[1] ?? null,
            crossSellProduct3: dto.productNames[2] ?? null,
            crossSellProduct4: dto.productNames[3] ?? null,
            crossSellProduct5: dto.productNames[4] ?? null,
            crossSellProduct6: dto.productNames[5] ?? null,
          },
        }),
      );
    } catch (error) {
      if (this.imageShared.isUniqueGenerationIdError(error)) {
        const replay = await this.prisma.image6.findUnique({
          where: { generationId: idempotency.generationId },
        });
        if (replay) {
          return sendResponse(
            'Image 6 already generated for this idempotency key',
            {
              image6: replay,
              idempotent: true,
            },
          );
        }
      }
      throw error;
    }

    await this.createOptimizationAudit({
      projectId,
      slot: ImageSlotType.CROSS_SELLING,
      action: OptimizationAction.GENERATION,
      imageRecordId: image6.id,
      versionNumber: image6.versionNumber,
      prompt: image6.generatedPrompt,
      refinePrompt: image6.refinePrompt,
      imageUrl: image6.imageUrl,
    });

    return sendResponse('Image 6 generated successfully', {
      image6,
      aiMeta: {
        jobId: aiResult.jobId ?? null,
        status: aiResult.status ?? null,
      },
    });
  }

  private async refineImage6(ownerId: string, dto: CreateImage6Dto) {
    // Step 1: Validate refine input (projectId + feedback + product names)
    if (!dto.projectId) {
      throw new BadRequestException('projectId is required for refine mode');
    }
    if (!dto.feedback?.trim()) {
      throw new BadRequestException('feedback is required for refine mode');
    }
    if (!dto.productNames?.length) {
      throw new BadRequestException(
        'productNames are required for refine mode',
      );
    }
    const projectId = dto.projectId;

    const key = this.imageShared.requireIdempotencyKey(dto.idempotencyKey);
    const idempotency = this.imageShared.buildGenerationId(
      'image6',
      ImageRequestMode.REFINE,
      key,
      {
        ownerId,
        projectId,
        style: dto.style ?? null,
        feedback: dto.feedback,
        productNames: dto.productNames,
      },
    );

    const existingImage6 = await this.prisma.image6.findUnique({
      where: { generationId: idempotency.generationId },
    });
    if (existingImage6) {
      return sendResponse('Image 6 already refined for this idempotency key', {
        image6: existingImage6,
        idempotent: true,
      });
    }

    const existingImage6ByKey = await this.prisma.image6.findFirst({
      where: {
        generationId: { startsWith: idempotency.keyPrefix },
      },
      select: { generationId: true },
    });
    this.imageShared.throwIfKeyReusedWithDifferentPayload(
      existingImage6ByKey?.generationId ?? null,
      idempotency.generationId,
    );

    // Step 2: Verify project ownership and fetch DB context
    const project = await this.imageShared.getOwnedProjectContext(
      projectId,
      ownerId,
    );

    const image6Source = await this.prisma.image6.findFirst({
      where: { projectId },
      orderBy: [{ versionNumber: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    if (!image6Source) {
      throw new NotFoundException(
        'No generated Image 6 found for this project to refine',
      );
    }
    const projectContextPayload = project as unknown as Record<string, unknown>;

    // Step 3: Call Image6 refine API
    const aiResult = await this.ai.refineImage6({
      projectContext: projectContextPayload,
      style: dto.style,
      feedback: dto.feedback,
      productNames: dto.productNames,
    });

    // Step 4: Resolve generated output URL
    const generatedImageUrl = await this.imageShared.resolveGeneratedImageUrl(
      aiResult.imageUrl,
      aiResult.imageBuffer,
      aiResult.imageMimeType,
      aiResult.imageFileName,
      'projects/generated/image6',
    );

    if (!generatedImageUrl) {
      if (aiResult.jobId || aiResult.status) {
        return sendResponse('Image 6 refine started', {
          image6: null,
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

    // Step 5: Create next Image6 version in one transaction
    let image6;
    try {
      image6 = await this.prisma.$transaction(async (tx) => {
        const latestVersion = await tx.image6.findFirst({
          where: { projectId },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true },
        });

        return tx.image6.create({
          data: {
            projectId,
            versionNumber: (latestVersion?.versionNumber ?? 1) + 1,
            generatedPrompt: aiResult.prompt,
            refinePrompt: aiResult.refinePrompt ?? dto.feedback,
            imageUrl: generatedImageUrl,
            generationId: idempotency.generationId,
            status: JobStatus.SUCCEEDED,
            crossSellProduct1: dto.productNames[0] ?? null,
            crossSellProduct2: dto.productNames[1] ?? null,
            crossSellProduct3: dto.productNames[2] ?? null,
            crossSellProduct4: dto.productNames[3] ?? null,
            crossSellProduct5: dto.productNames[4] ?? null,
            crossSellProduct6: dto.productNames[5] ?? null,
          },
        });
      });
    } catch (error) {
      if (this.imageShared.isUniqueGenerationIdError(error)) {
        const replay = await this.prisma.image6.findUnique({
          where: { generationId: idempotency.generationId },
        });
        if (replay) {
          return sendResponse(
            'Image 6 already refined for this idempotency key',
            {
              image6: replay,
              idempotent: true,
            },
          );
        }
      }
      throw error;
    }

    await this.createOptimizationAudit({
      projectId,
      slot: ImageSlotType.CROSS_SELLING,
      action: OptimizationAction.REFINE,
      imageRecordId: image6.id,
      versionNumber: image6.versionNumber,
      prompt: image6.generatedPrompt,
      refinePrompt: image6.refinePrompt,
      imageUrl: image6.imageUrl,
    });

    return sendResponse('Image 6 refined successfully', {
      image6,
      aiMeta: {
        jobId: aiResult.jobId ?? null,
        status: aiResult.status ?? null,
        refinePrompt: aiResult.refinePrompt ?? dto.feedback,
      },
    });
  }

  private async generateImage7(ownerId: string, dto: CreateImage7Dto) {
    // Step 1: Validate generation input
    if (!dto.projectId) {
      throw new BadRequestException('projectId is required for generation');
    }
    const projectId = dto.projectId;
    if (!dto.direction?.trim()) {
      throw new BadRequestException('direction is required for generation');
    }
    if (!dto.headline?.trim()) {
      throw new BadRequestException('headline is required for generation');
    }
    const key = this.imageShared.requireIdempotencyKey(dto.idempotencyKey);
    const idempotency = this.imageShared.buildGenerationId(
      'image7',
      ImageRequestMode.GENERATION,
      key,
      {
        ownerId,
        projectId,
        style: dto.style ?? null,
        direction: dto.direction,
        headline: dto.headline,
      },
    );

    const existingImage7 = await this.prisma.image7.findUnique({
      where: { generationId: idempotency.generationId },
    });
    if (existingImage7) {
      return sendResponse(
        'Image 7 already generated for this idempotency key',
        {
          image7: existingImage7,
          idempotent: true,
        },
      );
    }

    const existingImage7ByKey = await this.prisma.image7.findFirst({
      where: {
        generationId: { startsWith: idempotency.keyPrefix },
      },
      select: { generationId: true },
    });
    this.imageShared.throwIfKeyReusedWithDifferentPayload(
      existingImage7ByKey?.generationId ?? null,
      idempotency.generationId,
    );

    // Step 2: Verify project ownership and fetch DB context
    const project = await this.imageShared.getOwnedProjectContext(
      projectId,
      ownerId,
    );

    // Step 3: Call Image7 generation API
    const aiResult = await this.ai.generateImage7({
      projectContext: project,
      style: dto.style,
      direction: dto.direction,
      headline: dto.headline,
    });

    // Step 4: Resolve generated output URL
    const generatedImageUrl = await this.imageShared.resolveGeneratedImageUrl(
      aiResult.imageUrl,
      aiResult.imageBuffer,
      aiResult.imageMimeType,
      aiResult.imageFileName,
      'projects/generated/image7',
    );

    if (!generatedImageUrl) {
      if (aiResult.jobId || aiResult.status) {
        return sendResponse('Image 7 generation started', {
          image7: null,
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

    // Step 5: Persist initial Image7 row in one transaction
    let image7;
    try {
      image7 = await this.prisma.$transaction((tx) =>
        tx.image7.create({
          data: {
            projectId,
            versionNumber: 1,
            generatedPrompt: aiResult.prompt,
            imageUrl: generatedImageUrl,
            generationId: idempotency.generationId,
            status: JobStatus.SUCCEEDED,
            emotionDirection: dto.direction,
            customHeadline: dto.headline,
          },
        }),
      );
    } catch (error) {
      if (this.imageShared.isUniqueGenerationIdError(error)) {
        const replay = await this.prisma.image7.findUnique({
          where: { generationId: idempotency.generationId },
        });
        if (replay) {
          return sendResponse(
            'Image 7 already generated for this idempotency key',
            {
              image7: replay,
              idempotent: true,
            },
          );
        }
      }
      throw error;
    }

    await this.createOptimizationAudit({
      projectId,
      slot: ImageSlotType.CLOSING,
      action: OptimizationAction.GENERATION,
      imageRecordId: image7.id,
      versionNumber: image7.versionNumber,
      prompt: image7.generatedPrompt,
      refinePrompt: image7.refinePrompt,
      imageUrl: image7.imageUrl,
    });

    return sendResponse('Image 7 generated successfully', {
      image7,
      aiMeta: {
        jobId: aiResult.jobId ?? null,
        status: aiResult.status ?? null,
      },
    });
  }

  private async refineImage7(ownerId: string, dto: CreateImage7Dto) {
    // Step 1: Validate refine input (projectId + feedback + direction/headline)
    if (!dto.projectId) {
      throw new BadRequestException('projectId is required for refine mode');
    }
    if (!dto.feedback?.trim()) {
      throw new BadRequestException('feedback is required for refine mode');
    }
    if (!dto.direction?.trim()) {
      throw new BadRequestException('direction is required for refine mode');
    }
    if (!dto.headline?.trim()) {
      throw new BadRequestException('headline is required for refine mode');
    }
    const projectId = dto.projectId;

    const key = this.imageShared.requireIdempotencyKey(dto.idempotencyKey);
    const idempotency = this.imageShared.buildGenerationId(
      'image7',
      ImageRequestMode.REFINE,
      key,
      {
        ownerId,
        projectId,
        style: dto.style ?? null,
        feedback: dto.feedback,
        direction: dto.direction,
        headline: dto.headline,
      },
    );

    const existingImage7 = await this.prisma.image7.findUnique({
      where: { generationId: idempotency.generationId },
    });
    if (existingImage7) {
      return sendResponse('Image 7 already refined for this idempotency key', {
        image7: existingImage7,
        idempotent: true,
      });
    }

    const existingImage7ByKey = await this.prisma.image7.findFirst({
      where: {
        generationId: { startsWith: idempotency.keyPrefix },
      },
      select: { generationId: true },
    });
    this.imageShared.throwIfKeyReusedWithDifferentPayload(
      existingImage7ByKey?.generationId ?? null,
      idempotency.generationId,
    );

    // Step 2: Verify project ownership and fetch DB context
    const project = await this.imageShared.getOwnedProjectContext(
      projectId,
      ownerId,
    );

    const image7Source = await this.prisma.image7.findFirst({
      where: { projectId },
      orderBy: [{ versionNumber: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    if (!image7Source) {
      throw new NotFoundException(
        'No generated Image 7 found for this project to refine',
      );
    }
    const projectContextPayload = project as unknown as Record<string, unknown>;

    // Step 3: Call Image7 refine API
    const aiResult = await this.ai.refineImage7({
      projectContext: projectContextPayload,
      style: dto.style,
      feedback: dto.feedback,
      direction: dto.direction,
      headline: dto.headline,
    });

    // Step 4: Resolve generated output URL
    const generatedImageUrl = await this.imageShared.resolveGeneratedImageUrl(
      aiResult.imageUrl,
      aiResult.imageBuffer,
      aiResult.imageMimeType,
      aiResult.imageFileName,
      'projects/generated/image7',
    );

    if (!generatedImageUrl) {
      if (aiResult.jobId || aiResult.status) {
        return sendResponse('Image 7 refine started', {
          image7: null,
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

    // Step 5: Create next Image7 version in one transaction
    let image7;
    try {
      image7 = await this.prisma.$transaction(async (tx) => {
        const latestVersion = await tx.image7.findFirst({
          where: { projectId },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true },
        });

        return tx.image7.create({
          data: {
            projectId,
            versionNumber: (latestVersion?.versionNumber ?? 1) + 1,
            generatedPrompt: aiResult.prompt,
            refinePrompt: aiResult.refinePrompt ?? dto.feedback,
            imageUrl: generatedImageUrl,
            generationId: idempotency.generationId,
            status: JobStatus.SUCCEEDED,
            emotionDirection: dto.direction,
            customHeadline: dto.headline,
          },
        });
      });
    } catch (error) {
      if (this.imageShared.isUniqueGenerationIdError(error)) {
        const replay = await this.prisma.image7.findUnique({
          where: { generationId: idempotency.generationId },
        });
        if (replay) {
          return sendResponse(
            'Image 7 already refined for this idempotency key',
            {
              image7: replay,
              idempotent: true,
            },
          );
        }
      }
      throw error;
    }

    await this.createOptimizationAudit({
      projectId,
      slot: ImageSlotType.CLOSING,
      action: OptimizationAction.REFINE,
      imageRecordId: image7.id,
      versionNumber: image7.versionNumber,
      prompt: image7.generatedPrompt,
      refinePrompt: image7.refinePrompt,
      imageUrl: image7.imageUrl,
    });

    return sendResponse('Image 7 refined successfully', {
      image7,
      aiMeta: {
        jobId: aiResult.jobId ?? null,
        status: aiResult.status ?? null,
        refinePrompt: aiResult.refinePrompt ?? dto.feedback,
      },
    });
  }
}
