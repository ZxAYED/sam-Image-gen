import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { sendResponse } from 'src/utils/sendResponse';
import { AwsS3Service } from './aws-s3.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly awsS3: AwsS3Service,
  ) {}

  async createProjectWithImage(
    ownerId: string,
    dto: CreateProjectDto,
    image: Express.Multer.File,
  ) {
    const uploaded = await this.awsS3.uploadImage(image);

    try {
      const project = await this.prisma.project.create({
        data: {
          ownerId,
          name: dto.name,
          brandName: dto.brandName,
          productCategory: dto.productCategory,
          targetMarketplace: dto.targetMarketplace,
          status: dto.status,
          mainImage: uploaded.url,
          sku: dto.sku,
          shortDescription: dto.shortDescription,
          brandFontHeading: dto.brandFontHeading,
          brandFontSubheading: dto.brandFontSubheading,
        },
      });

      return sendResponse('Project created successfully', { project });
    } catch (error) {
      await this.awsS3.deleteImage(uploaded.key);
      throw error;
    }
  }
}
