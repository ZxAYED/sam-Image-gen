import {
  Body,
  Controller,
  HttpStatus,
  ParseFilePipeBuilder,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { memoryStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectsService } from './projects.service';

const createProjectResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    message: { type: 'string', example: 'Project created successfully' },
    data: {
      type: 'object',
      properties: {
        project: { type: 'object' },
      },
    },
  },
};

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post('create')
  @ApiOperation({
    summary: 'Create project with image upload',
    description:
      'Creates a project and uploads the main image to S3 in one request.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'name',
        'brandName',
        'productCategory',
        'targetMarketplace',
        'shortDescription',
        'image',
      ],
      properties: {
        name: { type: 'string' },
        brandName: { type: 'string' },
        productCategory: { type: 'string' },
        targetMarketplace: {
          type: 'string',
          enum: ['AMAZON', 'EBAY', 'SHOPIFY', 'ETSY', 'WALMART', 'OTHER'],
        },
        status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'] },
        sku: { type: 'string' },
        shortDescription: { type: 'string' },
        brandFontHeading: { type: 'string' },
        brandFontSubheading: { type: 'string' },
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Project created',
    schema: createProjectResponseSchema,
  })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  create(
    @Req() req: { user?: User },
    @Body() dto: CreateProjectDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /^image\/(jpg|jpeg|png|webp)$/i,
        })
        .addMaxSizeValidator({
          maxSize: 8 * 1024 * 1024,
        })
        .build({
          fileIsRequired: true,
          errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        }),
    )
    image: Express.Multer.File,
  ) {
    const ownerId = req.user?.id;
    if (!ownerId) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.projects.createProjectWithImage(ownerId, dto, image);
  }
}
