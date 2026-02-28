import {
  BadRequestException,
  Body,
  Controller,
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
  @Post('create')
  @ApiOperation({
    summary: 'Create project',
    description: 'Creates a project using JSON payload.',
  })
  create(@Req() req: { user?: User }, @Body() dto: CreateProjectDto) {
    const ownerId = req.user?.id;
    if (!ownerId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.projects.createProject(ownerId, dto);
  }

  @Roles(Role.USER as string)
  @Post('gen-image1')
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload main image and generate Image 1',
    description:
      'GENERATION mode accepts binary image upload with projectId. REFINE mode uses projectId + imageId + feedback.',
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

    return this.projects.createImage1ForProject(ownerId, dto, file);
  }

  @Roles(Role.USER as string)
  @Post('gen-image2')
  @ApiConsumes('application/json')
  @ApiOperation({
    summary: 'Generate or refine Image 2 (Key Facts)',
    description:
      'GENERATION and REFINE are both JSON. GENERATION uses projectId; REFINE uses projectId + imageId + feedback.',
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
      'GENERATION mode uploads a lifestyle image binary with projectId. REFINE mode uses projectId + imageId + feedback.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: 'object',
          required: ['idempotencyKey', 'mode', 'projectId', 'image'],
          properties: {
            idempotencyKey: { type: 'string' },
            projectId: { type: 'string', format: 'uuid' },
            mode: { type: 'string', enum: ['GENERATION'] },
            style: { type: 'string' },
            scenario: { type: 'string' },
            image: {
              type: 'string',
              format: 'binary',
              description:
                'Lifestyle provider image file (required when mode=GENERATION). Field name must be `image`.',
            },
          },
        },
        {
          type: 'object',
          required: [
            'idempotencyKey',
            'mode',
            'projectId',
            'imageId',
            'feedback',
          ],
          properties: {
            idempotencyKey: { type: 'string' },
            projectId: { type: 'string', format: 'uuid' },
            imageId: { type: 'string', format: 'uuid' },
            mode: { type: 'string', enum: ['REFINE'] },
            style: { type: 'string' },
            scenario: { type: 'string' },
            feedback: { type: 'string' },
          },
        },
      ],
    },
  })
  createImage3(
    @Req() req: { user?: User },
    @Body() dto: CreateImage3Dto,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    const ownerId = req.user?.id;
    if (!ownerId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const mode = dto.mode ?? ImageRequestMode.GENERATION;
    if (mode === ImageRequestMode.GENERATION && !file) {
      throw new BadRequestException(
        'Lifestyle image file is required for generation',
      );
    }

    return this.projects.createImage3ForProject(ownerId, dto, file);
  }

  @Roles(Role.USER as string)
  @Post('gen-image4')
  @ApiConsumes('application/json')
  @ApiOperation({
    summary: 'Generate or refine Image 4 (USP Highlight)',
    description:
      'JSON endpoint for Image 4. GENERATION uses projectId + usps; REFINE uses projectId + imageId + feedback + usps.',
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
          required: [
            'idempotencyKey',
            'mode',
            'projectId',
            'imageId',
            'feedback',
            'usps',
          ],
          properties: {
            idempotencyKey: { type: 'string' },
            projectId: { type: 'string', format: 'uuid' },
            imageId: { type: 'string', format: 'uuid' },
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
      'JSON endpoint for Image 5. GENERATION uses projectId + advantages + limitations; REFINE uses projectId + imageId + feedback.',
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
            'imageId',
            'feedback',
            'advantages',
            'limitations',
          ],
          properties: {
            idempotencyKey: { type: 'string' },
            projectId: { type: 'string', format: 'uuid' },
            imageId: { type: 'string', format: 'uuid' },
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
      'JSON endpoint for Image 6. GENERATION uses projectId + productNames; REFINE uses projectId + imageId + feedback + productNames.',
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
            'imageId',
            'feedback',
            'productNames',
          ],
          properties: {
            idempotencyKey: { type: 'string' },
            projectId: { type: 'string', format: 'uuid' },
            imageId: { type: 'string', format: 'uuid' },
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
      'JSON endpoint for Image 7. GENERATION uses projectId + direction + headline; REFINE uses projectId + imageId + feedback + direction + headline.',
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
            'imageId',
            'feedback',
            'direction',
            'headline',
          ],
          properties: {
            idempotencyKey: { type: 'string' },
            projectId: { type: 'string', format: 'uuid' },
            imageId: { type: 'string', format: 'uuid' },
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
