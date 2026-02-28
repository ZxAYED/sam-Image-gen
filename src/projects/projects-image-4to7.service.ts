import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { AiService } from 'src/ai/ai.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { sendResponse } from 'src/utils/sendResponse';
import { CreateImage4Dto } from './dto/create-image4.dto';
import { ImageRequestMode } from './dto/image-request-mode.enum';
import { ProjectsImageSharedService } from './projects-image-shared.service';

@Injectable()
export class ProjectsImage4To7Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly imageShared: ProjectsImageSharedService,
  ) {}

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

  private async generateImage4(ownerId: string, dto: CreateImage4Dto) {
    // Step 1: Validate generation input
    const projectId =
      typeof dto.projectContext?.id === 'string'
        ? dto.projectContext.id
        : dto.projectId;
    if (!projectId) {
      throw new BadRequestException(
        'projectContext.id is required for generation',
      );
    }
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

    // Step 3: Call Image4 generation API
    const aiResult = await this.ai.generateImage4({
      projectContext: project,
      style: dto.style,
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

    return sendResponse('Image 4 generated successfully', {
      image4,
      aiMeta: {
        jobId: aiResult.jobId ?? null,
        status: aiResult.status ?? null,
      },
    });
  }

  private async refineImage4(ownerId: string, dto: CreateImage4Dto) {
    // Step 1: Validate refine input (projectContext + feedback + usps)
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
    if (!dto.feedback?.trim()) {
      throw new BadRequestException('feedback is required for refine mode');
    }
    if (!dto.usps?.length) {
      throw new BadRequestException('usps are required for refine mode');
    }
    const projectContextPayload = projectContext as unknown as Record<
      string,
      unknown
    >;
    const key = this.imageShared.requireIdempotencyKey(dto.idempotencyKey);
    const idempotency = this.imageShared.buildGenerationId(
      'image4',
      ImageRequestMode.REFINE,
      key,
      {
        ownerId,
        projectContext: projectContextPayload,
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

    // Step 2: Verify project ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

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

    return sendResponse('Image 4 refined successfully', {
      image4,
      aiMeta: {
        jobId: aiResult.jobId ?? null,
        status: aiResult.status ?? null,
        refinePrompt: aiResult.refinePrompt ?? dto.feedback,
      },
    });
  }
}
