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
      'GENERATION mode accepts binary image upload. REFINE mode accepts JSON-like form fields with projectContext.',
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
      'GENERATION and REFINE are both JSON. Uses explicit projectContext object for refine.',
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
      'GENERATION mode uploads a lifestyle image binary. REFINE mode uses projectContext + refImageUrl.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['idempotencyKey', 'mode'],
      properties: {
        idempotencyKey: { type: 'string' },
        projectId: { type: 'string', format: 'uuid' },
        mode: { type: 'string', enum: ['GENERATION', 'REFINE'] },
        style: { type: 'string' },
        scenario: { type: 'string' },
        feedback: { type: 'string' },
        refImageUrl: { type: 'string', format: 'uri' },
        projectContext: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            brandName: { type: 'string' },
            productCategory: { type: 'string' },
            targetMarketplace: { type: 'string' },
            status: { type: 'string' },
            mainImage: { type: 'string', format: 'uri' },
            sku: { type: 'string' },
            shortDescription: { type: 'string' },
            brandFontHeading: { type: 'string' },
            brandFontSubheading: { type: 'string' },
          },
        },
        image: {
          type: 'string',
          format: 'binary',
          description:
            'Lifestyle provider image file (required when mode=GENERATION). Field name must be `image`.',
        },
      },
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
      'JSON endpoint for Image 4. Uses projectContext + usps for GENERATION and REFINE.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: 'object',
          required: ['idempotencyKey', 'mode', 'projectContext', 'usps'],
          properties: {
            idempotencyKey: { type: 'string' },
            mode: { type: 'string', enum: ['GENERATION'] },
            style: { type: 'string' },
            usps: {
              type: 'array',
              minItems: 1,
              maxItems: 4,
              items: { type: 'string' },
            },
            projectContext: {
              type: 'object',
              required: ['id'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                brandName: { type: 'string' },
                productCategory: { type: 'string' },
                targetMarketplace: { type: 'string' },
                status: { type: 'string' },
                mainImage: { type: 'string', format: 'uri' },
                sku: { type: 'string' },
                shortDescription: { type: 'string' },
                brandFontHeading: { type: 'string' },
                brandFontSubheading: { type: 'string' },
              },
            },
          },
        },
        {
          type: 'object',
          required: [
            'idempotencyKey',
            'mode',
            'projectContext',
            'feedback',
            'usps',
          ],
          properties: {
            idempotencyKey: { type: 'string' },
            mode: { type: 'string', enum: ['REFINE'] },
            style: { type: 'string' },
            feedback: { type: 'string' },
            usps: {
              type: 'array',
              minItems: 1,
              maxItems: 4,
              items: { type: 'string' },
            },
            projectContext: {
              type: 'object',
              required: ['id'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                brandName: { type: 'string' },
                productCategory: { type: 'string' },
                targetMarketplace: { type: 'string' },
                status: { type: 'string' },
                mainImage: { type: 'string', format: 'uri' },
                sku: { type: 'string' },
                shortDescription: { type: 'string' },
                brandFontHeading: { type: 'string' },
                brandFontSubheading: { type: 'string' },
              },
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
}
