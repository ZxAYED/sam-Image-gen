import { Injectable } from '@nestjs/common';
import type { UploadedFile } from 'src/common/types/uploaded-file.type';
import { PrismaService } from 'src/prisma/prisma.service';
import { sendResponse } from 'src/utils/sendResponse';
import { AwsS3Service } from './aws-s3.service';
import { CreateImage1Dto } from './dto/create-image1.dto';
import { CreateImage2Dto } from './dto/create-image2.dto';
import { CreateImage3Dto } from './dto/create-image3.dto';
import { CreateImage4Dto } from './dto/create-image4.dto';
import { CreateImage5Dto } from './dto/create-image5.dto';
import { CreateImage6Dto } from './dto/create-image6.dto';
import { CreateImage7Dto } from './dto/create-image7.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectsImageService } from './projects-image-1to3.service';
import { ProjectsImage4To7Service } from './projects-image-4to7.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ProjectsImageService,
    private readonly images4To7: ProjectsImage4To7Service,
    private readonly s3: AwsS3Service,
  ) { }

  async createProject(
    ownerId: string,
    dto: CreateProjectDto,
    brandLogoFile: UploadedFile,
  ) {
    const usps = (dto.usps ?? []).map((usp) => usp.trim()).filter(Boolean);
    const selectedLanguages = (dto.selectedLanguages ?? [])
      .map((language) => language.trim())
      .filter(Boolean);

    const uploadedBrandLogo = await this.s3.uploadBuffer({
      buffer: brandLogoFile.buffer,
      mimeType: brandLogoFile.mimetype,
      fileName: brandLogoFile.originalname,
      folder: 'projects/brand-logos',
    });

    try {
      const brandLogoAsset = await this.prisma.asset.create({
        data: {
          type: 'brand-logo',
          mimeType: brandLogoFile.mimetype,
          fileName: brandLogoFile.originalname,
          sizeBytes: brandLogoFile.buffer.length,
          storageKey: uploadedBrandLogo.key,
          publicUrl: uploadedBrandLogo.url,
        },
      });

      const project = await this.prisma.project.create({
        data: {
          ownerId,
          name: dto.name,
          brandName: dto.brandName,
          productCategory: dto.productCategory,
          productTitle: dto.productTitle,
          targetMarketplace: dto.targetMarketplace,
          status: dto.status,
          mainImage: null,
          brandLogoAssetId: uploadedBrandLogo.url,
          brandLogoInfoId: brandLogoAsset.id,
          sku: dto.sku,
          shortDescription: dto.shortDescription,
          downloadImageFormat: dto.downloadImageFormat,
          brandFontHeading: dto.brandFontHeading,
          brandFontSubheading: dto.brandFontSubheading,
          usps,
          optimizeKeywordsAmazon: dto.optimizeKeywordsAmazon ?? false,
          optimizeKeywordsGoogle: dto.optimizeKeywordsGoogle ?? false,
          selectedLanguages,
          projectStats: {
            create: {},
          },
        },
        include: {
          brandLogoInfo: true,
          projectStats: true,
        },
      });

      return sendResponse('Project created successfully', { project });
    } catch (error) {
      await this.s3.deleteImage(uploadedBrandLogo.key);
      throw error;
    }
  }

  async getDashboard(ownerId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      projectCount,
      productsOptimizedAggregate,
      images1ThisMonth,
      images2ThisMonth,
      images3ThisMonth,
      images4ThisMonth,
      images5ThisMonth,
      images6ThisMonth,
      images7ThisMonth,
      projects,
      marketplaceGroups,
      latestOptimizations,
    ] = await Promise.all([
      this.prisma.project.count({
        where: { ownerId },
      }),
      this.prisma.project.aggregate({
        where: { ownerId },
        _sum: { productsOptimized: true },
      }),
      this.prisma.image1.count({
        where: {
          createdAt: { gte: monthStart },
          project: { ownerId },
        },
      }),
      this.prisma.image2.count({
        where: {
          createdAt: { gte: monthStart },
          project: { ownerId },
        },
      }),
      this.prisma.image3.count({
        where: {
          createdAt: { gte: monthStart },
          project: { ownerId },
        },
      }),
      this.prisma.image4.count({
        where: {
          createdAt: { gte: monthStart },
          project: { ownerId },
        },
      }),
      this.prisma.image5.count({
        where: {
          createdAt: { gte: monthStart },
          project: { ownerId },
        },
      }),
      this.prisma.image6.count({
        where: {
          createdAt: { gte: monthStart },
          project: { ownerId },
        },
      }),
      this.prisma.image7.count({
        where: {
          createdAt: { gte: monthStart },
          project: { ownerId },
        },
      }),
      this.prisma.project.findMany({
        where: { ownerId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          brandName: true,
          productCategory: true,
          targetMarketplace: true,
          status: true,
          mainImage: true,
          updatedAt: true,
          _count: {
            select: {
              image1: true,
              image2: true,
              image3: true,
              image4: true,
              image5: true,
              image6: true,
              image7: true,
            },
          },
        },
      }),
      this.prisma.project.groupBy({
        by: ['targetMarketplace'],
        where: { ownerId },
      }),
      this.prisma.optimizationAudit.findMany({
        where: {
          project: { ownerId },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          projectId: true,
          slot: true,
          action: true,
          versionNumber: true,
          prompt: true,
          refinePrompt: true,
          imageUrl: true,
          createdAt: true,
          project: {
            select: {
              name: true,
              brandName: true,
            },
          },
        },
      }),
    ]);

    const imagesCreatedThisMonth =
      images1ThisMonth +
      images2ThisMonth +
      images3ThisMonth +
      images4ThisMonth +
      images5ThisMonth +
      images6ThisMonth +
      images7ThisMonth;

    const projectList = projects.map((project) => ({
      id: project.id,
      name: project.name,
      brandName: project.brandName,
      productCategory: project.productCategory,
      targetMarketplace: project.targetMarketplace,
      status: project.status,
      mainImage: project.mainImage,
      updatedAt: project.updatedAt,
      totalImages:
        project._count.image1 +
        project._count.image2 +
        project._count.image3 +
        project._count.image4 +
        project._count.image5 +
        project._count.image6 +
        project._count.image7,
    }));

    const data = {
      summary: {
        imagesCreatedThisMonth,
        productsOptimized:
          productsOptimizedAggregate._sum.productsOptimized ?? 0,
        targetMarketplaceCount: marketplaceGroups.length,
        numberOfProjects: projectCount,
      },
      projects: projectList,
      latestOptimizations: latestOptimizations.map((audit) => ({
        id: audit.id,
        projectId: audit.projectId,
        projectName: audit.project.name,
        brandName: audit.project.brandName,
        slot: audit.slot,
        action: audit.action,
        versionNumber: audit.versionNumber,
        prompt: audit.prompt,
        refinePrompt: audit.refinePrompt,
        imageUrl: audit.imageUrl,
        createdAt: audit.createdAt,
      })),
    };

    return sendResponse('Dashboard loaded successfully', data);
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

  async createImage6ForProject(ownerId: string, dto: CreateImage6Dto) {
    return this.images4To7.createImage6ForProject(ownerId, dto);
  }

  async createImage7ForProject(ownerId: string, dto: CreateImage7Dto) {
    return this.images4To7.createImage7ForProject(ownerId, dto);
  }
}
