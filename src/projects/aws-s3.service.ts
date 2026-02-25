import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { randomUUID } from 'crypto';

type UploadImageResult = {
  key: string;
  url: string;
};

@Injectable()
export class AwsS3Service {
  private readonly s3: S3;
  private readonly bucketName: string;

  constructor(private readonly config: ConfigService) {
    const bucketName = this.config.get<string>('AWS_S3_BUCKET_NAME');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    const region = this.config.get<string>('AWS_REGION');
    this.bucketName = bucketName ?? 'sam-app-storage-eu';

    this.s3 = new S3({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  private ensureAwsConfig(): string {
    const bucketName = this.config.get<string>('AWS_S3_BUCKET_NAME');
    const region = this.config.get<string>('AWS_REGION');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    if (!bucketName || !region || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException(
        'AWS S3 credentials/region/bucket are not configured',
      );
    }

    return region;
  }

  async uploadImage(file: Express.Multer.File): Promise<UploadImageResult> {
    const region = this.ensureAwsConfig();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `projects/main-images/${Date.now()}-${randomUUID()}-${safeName}`;

    try {
      const uploaded = await this.s3
        .upload({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read',
        })
        .promise();

      const url =
        uploaded.Location ??
        `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
      console.log('🚀 ~ AwsS3Service ~ uploadImage ~ url:', url);

      return { key, url };
    } catch {
      throw new InternalServerErrorException('Failed to upload image to S3');
    }
  }

  async deleteImage(key: string): Promise<void> {
    try {
      await this.s3
        .deleteObject({
          Bucket: this.bucketName,
          Key: key,
        })
        .promise();
    } catch {
      // Best effort cleanup only.
    }
  }
}
