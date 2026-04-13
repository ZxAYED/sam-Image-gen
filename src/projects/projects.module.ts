import { Module } from '@nestjs/common';
import { AiService } from 'src/ai/ai.service';
import { RedisCacheService } from 'src/common/cache/redis-cache.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AwsS3Service } from './aws-s3.service';
import { ProjectsImageService } from './projects-image-1to3.service';
import { ProjectsImage4To7Service } from './projects-image-4to7.service';
import { ProjectsImageSharedService } from './projects-image-shared.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectsImageService,
    ProjectsImage4To7Service,
    ProjectsImageSharedService,
    RedisCacheService,
    AwsS3Service,
    AiService,
  ],
  exports: [ProjectsService, AwsS3Service],
})
export class ProjectsModule {}
