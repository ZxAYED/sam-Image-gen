import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Marketplace, ProjectStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

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
    example: 'Premium Wireless Headphones',
    description: 'Product title shown in the listing setup flow.',
  })
  @IsString()
  @MaxLength(200)
  productTitle!: string;

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

  @ApiProperty({
    example: 'SKU-12345',
    description: 'Article number / SKU from the product information step.',
  })
  @IsString()
  @MaxLength(100)
  sku!: string;

  @ApiProperty({
    example: 'High quality insulated bottle',
    description: 'Short product description from the setup flow.',
  })
  @IsString()
  @MaxLength(2000)
  shortDescription!: string;

  @ApiProperty({
    example: 'jpg',
    description: 'Preferred download image format, e.g. jpg, png, webp.',
  })
  @IsString()
  @MaxLength(50)
  downloadImageFormat!: string;

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

  @ApiPropertyOptional({
    type: [String],
    example: [
      'Leakproof lid',
      'BPA-free material',
      '24h cold retention',
      'Ergonomic grip',
    ],
    description: 'Optional USP list from the setup flow. Maximum 4 values.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  usps?: string[];

  @ApiPropertyOptional({
    example: true,
    description: 'Enable marketplace-specific keyword optimization.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  optimizeKeywordsAmazon?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Enable Google keyword optimization.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  optimizeKeywordsGoogle?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ['English', 'German', 'French'],
    description: 'Selected languages for the project. Maximum 7 unique values.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  selectedLanguages?: string[];
}
