import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly uploadsDir = join(process.cwd(), 'uploads');

  constructor(private readonly config: ConfigService) {}

  private get s3Enabled(): boolean {
    return !!(
      this.config.get<string>('AWS_S3_BUCKET') &&
      this.config.get<string>('AWS_REGION') &&
      this.config.get<string>('AWS_ACCESS_KEY_ID') &&
      this.config.get<string>('AWS_SECRET_ACCESS_KEY')
    );
  }

  private sanitize(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  async upload(
    buffer: Buffer,
    filename: string,
    mimetype: string,
  ): Promise<string> {
    const key = `${uuidv4()}-${this.sanitize(filename)}`;

    if (this.s3Enabled) {
      return this.uploadToS3(buffer, key, mimetype);
    }
    return this.uploadToLocal(buffer, key);
  }

  private async uploadToS3(
    buffer: Buffer,
    key: string,
    mimetype: string,
  ): Promise<string> {
    const region = this.config.get<string>('AWS_REGION') as string;
    const bucket = this.config.get<string>('AWS_S3_BUCKET') as string;

    const client = new S3Client({
      region,
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID') as string,
        secretAccessKey: this.config.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        ) as string,
      },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      }),
    );

    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  private async uploadToLocal(buffer: Buffer, key: string): Promise<string> {
    await fs.mkdir(this.uploadsDir, { recursive: true });
    await fs.writeFile(join(this.uploadsDir, key), buffer);

    const publicUrl = (
      this.config.get<string>('PUBLIC_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    this.logger.debug(`Stored upload locally: ${key}`);
    return `${publicUrl}/uploads/${key}`;
  }
}
