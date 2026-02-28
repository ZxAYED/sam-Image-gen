import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { UploadedFile } from 'src/common/types/uploaded-file.type';

type UploadImageResult = {
  key: string;
  url: string;
};

type UploadBufferInput = {
  buffer: Buffer;
  mimeType?: string;
  fileName?: string;
  folder: string;
};

@Injectable()
export class AwsS3Service {
  private readonly s3: S3Client;
  private readonly bucketName: string;

  constructor(private readonly config: ConfigService) {
    const bucketName = this.config.get<string>('AWS_S3_BUCKET_NAME');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    const region = this.config.get<string>('AWS_REGION');
    this.bucketName = bucketName ?? 'sam-app-storage-eu';

    this.s3 = new S3Client({
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

  async uploadImage(file: UploadedFile): Promise<UploadImageResult> {
    const region = this.ensureAwsConfig();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `projects/main-images/${Date.now()}-${randomUUID()}-${safeName}`;

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );

      const url = `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;

      return { key, url };
    } catch (error) {
      console.error('Error uploading image to S3:', error);
      throw new InternalServerErrorException('Failed to upload image to S3');
    }
  }

  async uploadBuffer(input: UploadBufferInput): Promise<UploadImageResult> {
    const region = this.ensureAwsConfig();
    const safeName = (
      input.fileName ?? `${Date.now()}-${randomUUID()}`
    ).replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${input.folder}/${Date.now()}-${randomUUID()}-${safeName}`;

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: input.buffer,
          ContentType: input.mimeType ?? 'application/octet-stream',
        }),
      );

      const url = `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
      return { key, url };
    } catch (error) {
      console.error('Error uploading buffer to S3:', error);
      throw new InternalServerErrorException(
        'Failed to upload generated image',
      );
    }
  }

  async deleteImage(key: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
    } catch (error) {
      console.error('Error deleting image from S3:', error);
      // Best effort cleanup only.
    }
  }
}
