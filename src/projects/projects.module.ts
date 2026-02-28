import { Module } from '@nestjs/common';
import { AiService } from 'src/ai/ai.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AwsS3Service } from './aws-s3.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, AwsS3Service, AiService],
  exports: [ProjectsService, AwsS3Service],
})
export class ProjectsModule {}
