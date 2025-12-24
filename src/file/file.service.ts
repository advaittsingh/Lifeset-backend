import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';

@Injectable()
export class FileService {
  private s3: S3;

  constructor(private configService: ConfigService) {
    this.s3 = new S3({
      accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get('AWS_REGION'),
    });
  }

  async uploadFile(file: Buffer, key: string, contentType: string) {
    const bucket = this.configService.get('S3_BUCKET_NAME');
    
    // If AWS credentials are not configured, return a local URL for development
    if (!this.configService.get('AWS_ACCESS_KEY_ID') || !bucket) {
      // For local development, return a data URL or local path
      const base64 = file.toString('base64');
      return {
        Location: `data:${contentType};base64,${base64}`,
        Key: key,
      };
    }

    return this.s3
      .upload({
        Bucket: bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
      })
      .promise();
  }

  async getSignedUrl(key: string, expiresIn: number = 3600) {
    const bucket = this.configService.get('S3_BUCKET_NAME');

    return this.s3.getSignedUrlPromise('getObject', {
      Bucket: bucket,
      Key: key,
      Expires: expiresIn,
    });
  }

  async deleteFile(key: string) {
    const bucket = this.configService.get('S3_BUCKET_NAME');

    return this.s3
      .deleteObject({
        Bucket: bucket,
        Key: key,
      })
      .promise();
  }
}

