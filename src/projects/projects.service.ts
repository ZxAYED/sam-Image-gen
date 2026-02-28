import { Injectable } from '@nestjs/common';
import type { UploadedFile } from 'src/common/types/uploaded-file.type';
import { PrismaService } from 'src/prisma/prisma.service';
import { sendResponse } from 'src/utils/sendResponse';
import { CreateImage1Dto } from './dto/create-image1.dto';
import { CreateImage2Dto } from './dto/create-image2.dto';
import { CreateImage3Dto } from './dto/create-image3.dto';
import { CreateImage4Dto } from './dto/create-image4.dto';
import { CreateImage5Dto } from './dto/create-image5.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectsImageService } from './projects-image-1to3.service';
import { ProjectsImage4To7Service } from './projects-image-4to7.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ProjectsImageService,
    private readonly images4To7: ProjectsImage4To7Service,
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
    return this.images.createImage1ForProject(ownerId, dto, file);
  }

  async createImage2ForProject(ownerId: string, dto: CreateImage2Dto) {
    return this.images.createImage2ForProject(ownerId, dto);
  }

  async createImage3ForProject(
    ownerId: string,
    dto: CreateImage3Dto,
    file?: UploadedFile,
  ) {
    return this.images.createImage3ForProject(ownerId, dto, file);
  }

  async createImage4ForProject(ownerId: string, dto: CreateImage4Dto) {
    return this.images4To7.createImage4ForProject(ownerId, dto);
  }

  async createImage5ForProject(ownerId: string, dto: CreateImage5Dto) {
    return this.images4To7.createImage5ForProject(ownerId, dto);
  }
}
