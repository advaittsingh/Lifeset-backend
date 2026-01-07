import { Controller, Post, Get, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileService } from './file.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { memoryStorage } from 'multer';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const logger = new Logger('FileController');

// Multer configuration with file size limits
// Using memory storage since we upload directly to S3
const multerOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req: any, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException(`File type ${file.mimetype} not allowed. Allowed types: images (JPEG, PNG, GIF, WebP) and PDFs`), false);
    }
  },
};

@ApiTags('Files')
@Controller('files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload file (images, PDFs, etc.)' })
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      logger.error('No file provided in upload request');
      // Check if request has any files at all
      throw new BadRequestException('No file provided. Please select a file to upload. Make sure the form field is named "file".');
    }

    logger.log(`Uploading file: ${file.originalname}, size: ${file.size} bytes, type: ${file.mimetype}`);

    try {
    // Validate file type
    const allowedMimeTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    
    if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(`File type ${file.mimetype} not allowed. Allowed types: images (JPEG, PNG, GIF, WebP) and PDFs`);
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException(`File size ${file.size} bytes exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes (10MB)`);
    }

    // Determine folder based on file type
    const folder = file.mimetype === 'application/pdf' ? 'certificates' : 'uploads';
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `${folder}/${Date.now()}-${sanitizedFilename}`;
      
      logger.log(`Uploading to S3 with key: ${key}`);
    
    const result = await this.fileService.uploadFile(
      file.buffer,
      key,
      file.mimetype,
    );

      logger.log(`File uploaded successfully. URL: ${result.Location}`);

    // Return data directly - TransformInterceptor will wrap it with { success: true, data: {...}, timestamp: ... }
    return {
        url: result.Location,
        key: result.Key,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
    };
    } catch (error: any) {
      logger.error(`File upload failed: ${error.message}`, error.stack);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Failed to upload file: ${error.message || 'Unknown error'}`);
    }
  }

  @Post('upload/certificate')
  @UseInterceptors(FileInterceptor('file', {
    ...multerOptions,
    fileFilter: (req: any, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
      // Only allow PDFs for certificates
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new BadRequestException('Only PDF files are allowed for certificates'), false);
      }
    },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload certificate or degree PDF' })
  async uploadCertificate(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      logger.error('No file provided in certificate upload request');
      throw new BadRequestException('No file provided. Please select a PDF file to upload.');
    }

    logger.log(`Uploading certificate: ${file.originalname}, size: ${file.size} bytes`);

    try {
    // Only allow PDFs for certificates
    if (file.mimetype !== 'application/pdf') {
        throw new BadRequestException('Only PDF files are allowed for certificates');
    }

      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `certificates/${Date.now()}-${sanitizedFilename}`;
      
      logger.log(`Uploading certificate to S3 with key: ${key}`);
      
    const result = await this.fileService.uploadFile(
      file.buffer,
      key,
      file.mimetype,
    );

      logger.log(`Certificate uploaded successfully. URL: ${result.Location}`);

    // Return data directly - TransformInterceptor will wrap it with { success: true, data: {...}, timestamp: ... }
    return {
        url: result.Location,
        key: result.Key,
        fileName: file.originalname,
        fileSize: file.size,
        type: 'certificate',
    };
    } catch (error: any) {
      logger.error(`Certificate upload failed: ${error.message}`, error.stack);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Failed to upload certificate: ${error.message || 'Unknown error'}`);
    }
  }

  @Get('url/:key')
  @ApiOperation({ summary: 'Get signed URL' })
  async getSignedUrl(@Param('key') key: string) {
    const url = await this.fileService.getSignedUrl(key);
    return { url };
  }
}

