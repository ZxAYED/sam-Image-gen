import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Marketplace, ProjectStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Premium Bottle Listing' })
  @IsString()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 'Sina Laut' })
  @IsString()
  @MaxLength(150)
  brandName!: string;

  @ApiProperty({ example: 'Kitchen & Dining' })
  @IsString()
  @MaxLength(150)
  productCategory!: string;

  @ApiProperty({
    enum: ['AMAZON', 'EBAY', 'SHOPIFY', 'ETSY', 'WALMART', 'OTHER'],
    description:
      'Marketplace enum values: AMAZON, EBAY, SHOPIFY, ETSY, WALMART, OTHER.',
  })
  @IsEnum(Marketplace)
  targetMarketplace!: Marketplace;

  @ApiPropertyOptional({
    enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
    default: ProjectStatus.DRAFT,
    description: 'Project status enum values: DRAFT, ACTIVE, ARCHIVED.',
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ example: 'SKU-001' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @ApiProperty({ example: 'High quality insulated bottle' })
  @IsString()
  @MaxLength(2000)
  shortDescription!: string;

  @ApiPropertyOptional({ example: 'Montserrat' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brandFontHeading?: string;

  @ApiPropertyOptional({ example: 'Open Sans' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brandFontSubheading?: string;
}
