import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';

@Injectable()
export class FileService {
  private s3: S3;
  private readonly logger = new Logger(FileService.name);

  constructor(private configService: ConfigService) {
    const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
    const region = this.configService.get('AWS_REGION') || 'ap-south-1';
    const bucket = this.configService.get('S3_BUCKET_NAME');

    this.logger.log(`Initializing S3 service. Region: ${region}, Bucket: ${bucket || 'NOT SET'}, Has Credentials: ${!!accessKeyId}`);

    // Initialize S3 even if credentials are missing (for development)
    this.s3 = new S3({
      accessKeyId: accessKeyId,
      secretAccessKey: secretAccessKey,
      region: region,
    });
  }

  async uploadFile(file: Buffer, key: string, contentType: string) {
    const bucket = this.configService.get('S3_BUCKET_NAME');
    const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
    
    this.logger.log(`Uploading file. Key: ${key}, Size: ${file.length} bytes, ContentType: ${contentType}, Bucket: ${bucket || 'NOT SET'}`);
    
    // If AWS credentials are not configured, return a local URL for development
    if (!accessKeyId || !bucket) {
      this.logger.warn('AWS credentials or S3 bucket not configured. Returning data URL for development.');
      // For local development, return a data URL or local path
      const base64 = file.toString('base64');
      return {
        Location: `data:${contentType};base64,${base64}`,
        Key: key,
      };
    }

    try {
      const result = await this.s3
      .upload({
        Bucket: bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
          ACL: 'public-read', // Make files publicly readable
      })
      .promise();

      this.logger.log(`File uploaded successfully to S3. Location: ${result.Location}`);
      return result;
    } catch (error: any) {
      this.logger.error(`S3 upload failed: ${error.message}`, error.stack);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
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

