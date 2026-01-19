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
      const uploadParams: any = {
        Bucket: bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
      };

      // Try with ACL first (for buckets that support it)
      uploadParams.ACL = 'public-read';

      try {
        const result = await this.s3.upload(uploadParams).promise();
        this.logger.log(`File uploaded successfully to S3. Location: ${result.Location}`);
        return result;
      } catch (aclError: any) {
        // If ACL is not allowed, retry without ACL (bucket policy should handle public access)
        if (aclError.code === 'AccessControlListNotSupported' || 
            aclError.message?.includes('does not allow ACLs') ||
            aclError.message?.includes('ACL')) {
          this.logger.warn('Bucket does not allow ACLs, uploading without ACL (relying on bucket policy)');
          
          // Remove ACL and retry
          delete uploadParams.ACL;
          const result = await this.s3.upload(uploadParams).promise();
          this.logger.log(`File uploaded successfully to S3 without ACL. Location: ${result.Location}`);
          return result;
        }
        // If it's a different error, throw it
        throw aclError;
      }
    } catch (error: any) {
      this.logger.error(`S3 upload failed: ${error.message}`, error.stack);
      
      // Provide more specific error messages
      if (error.code === 'NoSuchBucket') {
        throw new Error(`S3 bucket "${bucket}" does not exist. Please check your S3 bucket configuration.`);
      }
      
      if (error.code === 'AccessDenied' || error.code === 'InvalidAccessKeyId') {
        throw new Error(`AWS credentials are invalid or insufficient permissions. Please check your AWS configuration.`);
      }
      
      if (error.code === 'RequestTimeout' || error.code === 'ETIMEDOUT') {
        throw new Error(`Upload timeout. The file may be too large or network connection is slow. Please try again.`);
      }
      
      throw new Error(`Failed to upload file to S3: ${error.message || 'Unknown error'}`);
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

