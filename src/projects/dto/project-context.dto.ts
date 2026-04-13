import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ProjectContextDto {
  @ApiProperty({
    format: 'uuid',
    example: 'f0c02bd3-e90f-4fdc-9f3f-13f4cc4a1f58',
  })
  @IsUUID()
  id!: string;

  @ApiPropertyOptional({ example: 'Hydration Bottle Launch' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'Sina Laut' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  brandName?: string;

  @ApiPropertyOptional({ example: 'Bottle' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  productCategory?: string;

  @ApiPropertyOptional({ example: 'AMAZON' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  targetMarketplace?: string;

  @ApiPropertyOptional({ example: 'DRAFT' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @ApiPropertyOptional({ example: 'https://example.com/main.png' })
  @IsOptional()
  @IsString()
  mainImage?: string;

  @ApiPropertyOptional({ example: 'SKU-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sku?: string;

  @ApiPropertyOptional({ example: 'Premium stainless steel bottle' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  shortDescription?: string;

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
