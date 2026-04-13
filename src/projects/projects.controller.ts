import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Role, User } from '@prisma/client';
import { Roles } from 'src/common/decorator/rolesDecorator';
import type { UploadedFile as UploadedImageFile } from 'src/common/types/uploaded-file.type';
import { CreateImage1Dto } from './dto/create-image1.dto';
import { CreateImage2Dto } from './dto/create-image2.dto';
import { CreateImage3Dto } from './dto/create-image3.dto';
import { CreateImage4Dto } from './dto/create-image4.dto';
import { CreateImage5Dto } from './dto/create-image5.dto';
import { CreateImage6Dto } from './dto/create-image6.dto';
import { CreateImage7Dto } from './dto/create-image7.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { ImageRequestMode } from './dto/image-request-mode.enum';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Roles(Role.USER as string)
  @Get('dashboard')
  @ApiOperation({
    summary: 'Get dashboard summary and own projects',
    description:
      'Returns dashboard card summary + all projects owned by authenticated user in one API.',
  })
  getDashboard(@Req() req: { user?: User }) {
    const ownerId = req.user?.id;
    if (!ownerId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.projects.getDashboard(ownerId);
  }

  @Roles(Role.USER as string)
  @Post('create')
  @UseInterceptors(FileInterceptor('brandLogo'))
  @ApiOperation({
    summary: 'Create project',
    description:
      'Creates a project from multipart form-data. Send `data` as JSON string and `brandLogo` as the uploaded logo file.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['data', 'brandLogo'],
      properties: {
        data: {
          type: 'string',
          description: 'JSON string containing the CreateProjectDto payload.',
          example: JSON.stringify(
            {
              name: 'Summer Collection 2024',
              brandName: 'EcoStyle',
              productCategory: 'Fashion',
              productTitle: 'Premium Wireless Headphones',
              targetMarketplace: 'AMAZON',
              status: 'DRAFT',
              sku: 'SKU-12345',
              shortDescription: 'Brief description of your product...',
              downloadImageFormat: 'jpg',
              brandFontHeading: 'Inter',
              brandFontSubheading: 'Roboto',
              usps: [
                'Leakproof lid',
                'BPA-free material',
                '24h cold retention',
                'Ergonomic grip',
              ],
              optimizeKeywordsAmazon: true,
              optimizeKeywordsGoogle: false,
              selectedLanguages: ['English', 'German'],
            },
            null,
            2,
          ),
        },
        brandLogo: {
          type: 'string',
          format: 'binary',
          description: 'Brand logo file uploaded by frontend.',
        },
      },
    },
  })
  create(
    @Req() req: { user?: User },
    @Body('data') rawData: string,
    @UploadedFile() brandLogoFile?: UploadedImageFile,
  ) {
    const ownerId = req.user?.id;
    if (!ownerId) {
      throw new UnauthorizedException('Unauthorized');
    }

    if (!brandLogoFile) {
      throw new BadRequestException('brandLogo file is required');
    }

    if (!rawData) {
      throw new BadRequestException('data is required');
    }

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(rawData);
    } catch {
      throw new BadRequestException('data must be valid JSON');
    }

    const dto = plainToInstance(CreateProjectDto, parsedData);
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const messages = errors
        .flatMap((error) => Object.values(error.constraints ?? {}))
        .filter(Boolean);
      throw new BadRequestException(
        messages[0] ?? 'Project data validation failed',
      );
    }

    return this.projects.createProject(ownerId, dto, brandLogoFile);
  }

  @Roles(Role.USER as string)
  @Post('gen-image1')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Generate or refine Image 1',
    description:
      'Single mode-based endpoint. GENERATION requires image upload; REFINE requires feedback and automatically uses latest generated Image 1 for this user+project.',
  })
  @ApiBody({
    description:
      'Multipart form-data. For GENERATION: send image file (binary). For REFINE: do not send image; send feedback.',
    schema: {
      type: 'object',
      required: ['idempotencyKey', 'mode', 'projectId'],
      properties: {
        idempotencyKey: {
          type: 'string',
          example: '9f1f2f6a-3fbb-4421-9287-09f4571d65aa',
        },
        mode: { type: 'string', enum: ['GENERATION', 'REFINE'] },
        projectId: {
          type: 'string',
          format: 'uuid',
          example: 'ab1573bf-28b6-43c9-af70-d3369784ea0d',
        },
        style: {
          type: 'string',
          example: 'clean-white-background',
        },
        feedback: {
          type: 'string',
          example: 'Make product larger and improve shadow softness',
          description: 'Required when mode=REFINE',
        },
        image: {
          type: 'string',
          format: 'binary',
          description:
            'Required when mode=GENERATION. Field name must be `image`.',
        },
      },
    },
    examples: {
      generation: {
        summary: 'Generation payload',
        value: {
          idempotencyKey: '9f1f2f6a-3fbb-4421-9287-09f4571d65aa',
          mode: 'GENERATION',
          projectId: 'ab1573bf-28b6-43c9-af70-d3369784ea0d',
          style: 'clean-white-background',
          image: '(binary file)',
        },
      },
      refine: {
        summary: 'Refine payload',
        value: {
          idempotencyKey: '9f1f2f6a-3fbb-4421-9287-09f4571d65aa',
          mode: 'REFINE',
          projectId: 'ab1573bf-28b6-43c9-af70-d3369784ea0d',
          style: 'clean-white-background',
          feedback: 'Increase product size and reduce shadow intensity',
        },
      },
    },
  })
  createImage1(
    @Req() req: { user?: User },
    @Body() dto: CreateImage1Dto,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    const ownerId = req.user?.id;
    if (!ownerId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const mode = dto.mode ?? ImageRequestMode.GENERATION;
    if (mode === ImageRequestMode.GENERATION && !file) {
      throw new BadRequestException('Image file is required for generation');
    }
    if (mode === ImageRequestMode.REFINE && file) {
      throw new BadRequestException(
        'Image file is not accepted in refine mode',
      );
    }

    return this.projects.createImage1ForProject(ownerId, dto, file);
  }

  @Roles(Role.USER as string)
  @Post('gen-image2')
  @ApiConsumes('application/json')
  @ApiOperation({
    summary: 'Generate or refine Image 2 (Key Facts)',
    description:
      'GENERATION and REFINE are both JSON. GENERATION uses projectId; REFINE uses projectId + feedback and auto-picks latest Image 2.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: 'object',
          required: [
            'idempotencyKey',
            'mode',
            'projectId',
            'keyFact1',
            'keyFact2',
            'keyFact3',
            'keyFact4',
          ],
          properties: {
            idempotencyKey: { type: 'string' },
            mode: { type: 'string', enum: ['GENERATION'] },
            projectId: { type: 'string', format: 'uuid' },
            style: { type: 'string' },
            backgroundStyle: { type: 'string' },
            logoPosition: { type: 'string' },
            keyFact1: { type: 'string' },
            keyFact2: { type: 'string' },
            keyFact3: { type: 'string' },
            keyFact4: { type: 'string' },
          },
        },
        {
          type: 'object',
          required: [
            'idempotencyKey',
            'mode',
            'projectId',
            'feedback',
            'keyFact1',
            'keyFact2',
            'keyFact3',
            'keyFact4',
          ],
          properties: {
            idempotencyKey: { type: 'string' },
            mode: { type: 'string', enum: ['REFINE'] },
            projectId: { type: 'string', format: 'uuid' },
            style: { type: 'string' },
            backgroundStyle: { type: 'string' },
            logoPosition: { type: 'string' },
            feedback: { type: 'string' },
            keyFact1: { type: 'string' },
            keyFact2: { type: 'string' },
            keyFact3: { type: 'string' },
            keyFact4: { type: 'string' },
          },
        },
      ],
    },
  })
  createImage2(@Req() req: { user?: User }, @Body() dto: CreateImage2Dto) {
    const ownerId = req.user?.id;
    if (!ownerId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.projects.createImage2ForProject(ownerId, dto);
  }

  @Roles(Role.USER as string)
  @Post('gen-image3')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Generate or refine Image 3 (Lifestyle)',
    description:
      'GENERATION mode uploads a lifestyle image binary with projectId. REFINE mode uses projectId + feedback and auto-picks latest Image 3.',
  })
  @ApiBody({
    description:
      'Send multipart/form-data with `data` as JSON string and `image` as binary file. In REFINE mode, image is not required.',
    schema: {
      type: 'object',
      required: ['data'],
      properties: {
        data: {
          type: 'string',
          description:
            'JSON string for CreateImage3Dto fields (idempotencyKey, projectId, mode, style, scenario, feedback).',
          example: JSON.stringify(
            {
              idempotencyKey: '9f1f2f6a-3fbb-4421-9287-09f4571d65aa',
              projectId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
              mode: 'GENERATION',
              style: 'playful',
              scenario: 'A family picnic in bright daylight',
            },
            null,
            2,
          ),
        },
        image: {
          type: 'string',
          format: 'binary',
          description:
            'Lifestyle provider image file. Required when mode=GENERATION.',
        },
      },
    },
    examples: {
      generation: {
        summary: 'Generation payload',
        value: {
          data: JSON.stringify({
            idempotencyKey: '9f1f2f6a-3fbb-4421-9287-09f4571d65aa',
            projectId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
            mode: 'GENERATION',
            style: 'playful',
            scenario: 'A family picnic in bright daylight',
          }),
          image: '(binary file)',
        },
      },
      refine: {
        summary: 'Refine payload',
        value: {
          data: JSON.stringify({
            idempotencyKey: '9f1f2f6a-3fbb-4421-9287-09f4571d65aa',
            projectId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
            mode: 'REFINE',
            style: 'playful',
            scenario: 'A family picnic in bright daylight',
            feedback: 'Make product bigger and warmer',
          }),
        },
      },
    },
  })
  createImage3(
    @Req() req: { user?: User },
    @Body() body: Record<string, unknown>,
    @Body('data') rawData?: string,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    const ownerId = req.user?.id;
    if (!ownerId) {
      throw new UnauthorizedException('Unauthorized');
    }

    let payload: unknown = body;
    if (rawData) {
      try {
        payload = JSON.parse(rawData);
      } catch {
        throw new BadRequestException('data must be valid JSON');
      }
    }

    const dto = plainToInstance(CreateImage3Dto, payload);
    const errors = validateSync(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      const messages = errors
        .flatMap((error) => Object.values(error.constraints ?? {}))
        .filter(Boolean);
      throw new BadRequestException(messages[0] ?? 'Image 3 data is invalid');
    }

    const mode = dto.mode ?? ImageRequestMode.GENERATION;
    if (mode === ImageRequestMode.GENERATION && !file) {
      throw new BadRequestException(
        'Lifestyle image file is required for generation',
      );
    }
    if (mode === ImageRequestMode.REFINE && file) {
      throw new BadRequestException('Image file is not accepted in refine mode');
    }

    return this.projects.createImage3ForProject(ownerId, dto, file);
  }

  @Roles(Role.USER as string)
  @Post('gen-image4')
  @ApiConsumes('application/json')
  @ApiOperation({
    summary: 'Generate or refine Image 4 (USP Highlight)',
    description:
      'JSON endpoint for Image 4. GENERATION uses projectId + usps; REFINE uses projectId + feedback + usps and auto-picks latest Image 4.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: 'object',
          required: ['idempotencyKey', 'mode', 'projectId', 'usps'],
          properties: {
            idempotencyKey: { type: 'string' },
            mode: { type: 'string', enum: ['GENERATION'] },
            projectId: { type: 'string', format: 'uuid' },
            style: { type: 'string' },
            usps: {
              type: 'array',
              minItems: 1,
              maxItems: 4,
              items: { type: 'string' },
            },
          },
        },
        {
          type: 'object',
          required: ['idempotencyKey', 'mode', 'projectId', 'feedback', 'usps'],
          properties: {
            idempotencyKey: { type: 'string' },
            projectId: { type: 'string', format: 'uuid' },
            mode: { type: 'string', enum: ['REFINE'] },
            style: { type: 'string' },
            feedback: { type: 'string' },
            usps: {
              type: 'array',
              minItems: 1,
              maxItems: 4,
              items: { type: 'string' },
            },
          },
        },
      ],
    },
  })
  createImage4(@Req() req: { user?: User }, @Body() dto: CreateImage4Dto) {
    const ownerId = req.user?.id;
    if (!ownerId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.projects.createImage4ForProject(ownerId, dto);
  }

  @Roles(Role.USER as string)
  @Post('gen-image5')
  @ApiConsumes('application/json')
  @ApiOperation({
    summary: 'Generate or refine Image 5 (Comparison)',
    description:
      'JSON endpoint for Image 5. GENERATION uses projectId + advantages + limitations; REFINE uses projectId + feedback and auto-picks latest Image 5.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: 'object',
          required: [
            'idempotencyKey',
            'mode',
            'projectId',
            'advantages',
            'limitations',
          ],
          properties: {
            idempotencyKey: { type: 'string' },
            mode: { type: 'string', enum: ['GENERATION'] },
            projectId: { type: 'string', format: 'uuid' },
            style: { type: 'string' },
            advantages: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: { type: 'string' },
            },
            limitations: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: { type: 'string' },
            },
          },
        },
        {
          type: 'object',
          required: [
            'idempotencyKey',
            'mode',
            'projectId',
            'feedback',
            'advantages',
            'limitations',
          ],
          properties: {
            idempotencyKey: { type: 'string' },
            projectId: { type: 'string', format: 'uuid' },
            mode: { type: 'string', enum: ['REFINE'] },
            style: { type: 'string' },
            feedback: { type: 'string' },
            advantages: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: { type: 'string' },
            },
            limitations: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: { type: 'string' },
            },
          },
        },
      ],
    },
  })
  createImage5(@Req() req: { user?: User }, @Body() dto: CreateImage5Dto) {
    const ownerId = req.user?.id;
    if (!ownerId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.projects.createImage5ForProject(ownerId, dto);
  }

  @Roles(Role.USER as string)
  @Post('gen-image6')
  @ApiConsumes('application/json')
  @ApiOperation({
    summary: 'Generate or refine Image 6 (Cross-Selling)',
    description:
      'JSON endpoint for Image 6. GENERATION uses projectId + productNames; REFINE uses projectId + feedback + productNames and auto-picks latest Image 6.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: 'object',
          required: ['idempotencyKey', 'mode', 'projectId', 'productNames'],
          properties: {
            idempotencyKey: { type: 'string' },
            mode: { type: 'string', enum: ['GENERATION'] },
            projectId: { type: 'string', format: 'uuid' },
            style: { type: 'string' },
            productNames: {
              type: 'array',
              minItems: 1,
              maxItems: 6,
              items: { type: 'string' },
            },
          },
        },
        {
          type: 'object',
          required: [
            'idempotencyKey',
            'mode',
            'projectId',
            'feedback',
            'productNames',
          ],
          properties: {
            idempotencyKey: { type: 'string' },
            projectId: { type: 'string', format: 'uuid' },
            mode: { type: 'string', enum: ['REFINE'] },
            style: { type: 'string' },
            feedback: { type: 'string' },
            productNames: {
              type: 'array',
              minItems: 1,
              maxItems: 6,
              items: { type: 'string' },
            },
          },
        },
      ],
    },
  })
  createImage6(@Req() req: { user?: User }, @Body() dto: CreateImage6Dto) {
    const ownerId = req.user?.id;
    if (!ownerId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.projects.createImage6ForProject(ownerId, dto);
  }

  @Roles(Role.USER as string)
  @Post('gen-image7')
  @ApiConsumes('application/json')
  @ApiOperation({
    summary: 'Generate or refine Image 7 (Closing)',
    description:
      'JSON endpoint for Image 7. GENERATION uses projectId + direction + headline; REFINE uses projectId + feedback + direction + headline and auto-picks latest Image 7.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: 'object',
          required: [
            'idempotencyKey',
            'mode',
            'projectId',
            'direction',
            'headline',
          ],
          properties: {
            idempotencyKey: { type: 'string' },
            mode: { type: 'string', enum: ['GENERATION'] },
            projectId: { type: 'string', format: 'uuid' },
            style: { type: 'string' },
            direction: { type: 'string' },
            headline: { type: 'string' },
          },
        },
        {
          type: 'object',
          required: [
            'idempotencyKey',
            'mode',
            'projectId',
            'feedback',
            'direction',
            'headline',
          ],
          properties: {
            idempotencyKey: { type: 'string' },
            projectId: { type: 'string', format: 'uuid' },
            mode: { type: 'string', enum: ['REFINE'] },
            style: { type: 'string' },
            feedback: { type: 'string' },
            direction: { type: 'string' },
            headline: { type: 'string' },
          },
        },
      ],
    },
  })
  createImage7(@Req() req: { user?: User }, @Body() dto: CreateImage7Dto) {
    const ownerId = req.user?.id;
    if (!ownerId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.projects.createImage7ForProject(ownerId, dto);
  }
}
