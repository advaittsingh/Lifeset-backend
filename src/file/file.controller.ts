import { Controller, Post, Get, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Logger, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileService } from './file.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { memoryStorage } from 'multer';
import sizeOf from 'image-size';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CAROUSEL_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for carousel images
const logger = new Logger('FileController');

// Carousel image requirements
const CAROUSEL_IMAGE_REQUIREMENTS = {
  minWidth: 800,
  maxWidth: 2560,
  minHeight: 400,
  maxHeight: 1440,
  recommendedWidth: 1200,
  recommendedHeight: 600,
  recommendedAspectRatio: '2:1', // width:height
  allowedFormats: ['JPEG', 'PNG', 'WebP'],
  maxFileSize: MAX_CAROUSEL_IMAGE_SIZE,
};

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
  @ApiOperation({ 
    summary: 'Upload file (images, PDFs, etc.)',
    description: `Upload a file (image or document). 
    
**Supported Image Formats:** JPEG, JPG, PNG, GIF, WebP
**Supported Document Formats:** PDF, DOC, DOCX
**Maximum File Size:** ${MAX_FILE_SIZE / (1024 * 1024)}MB

**For Carousel Images:** Use the dedicated /files/upload/carousel-image endpoint for better validation and requirements.`
  })
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    // Check Content-Type header first
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      logger.error(`Invalid Content-Type for file upload: ${contentType}. Expected multipart/form-data`);
      throw new BadRequestException(
        `Invalid Content-Type: "${contentType}". ` +
        'File uploads require "multipart/form-data" Content-Type. ' +
        'Make sure you are sending the file as FormData and not as URL-encoded form data. ' +
        'Example: Use FormData() in JavaScript or FormData in your HTTP client.'
      );
    }

    if (!file) {
      logger.error('No file provided in upload request', {
        contentType: req.headers['content-type'],
        headers: req.headers,
        body: req.body,
      });
      // Check if request has any files at all
      throw new BadRequestException(
        'No file provided. Please select a file to upload. ' +
        'Make sure: 1) The form field is named "file", 2) You are using FormData, ' +
        '3) The Content-Type is "multipart/form-data" (should be set automatically by FormData).'
      );
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
      
      // Provide more specific error messages
      if (error.message && (error.message.includes('S3') || error.message.includes('AWS'))) {
        throw new BadRequestException(
          'Failed to upload file to storage. Please check your AWS S3 configuration or try again later. ' +
          'If the problem persists, contact support.'
        );
      }
      
      if (error.message && error.message.includes('credentials')) {
        throw new BadRequestException(
          'Storage service configuration error. Please contact support.'
        );
      }
      
      throw new BadRequestException(
        `Failed to upload file: ${error.message || 'Unknown error'}. ` +
        'Please ensure the file meets the requirements and try again.'
      );
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

  @Post('upload/carousel-image')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: {
      fileSize: MAX_CAROUSEL_IMAGE_SIZE,
    },
    fileFilter: (req: any, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
      // Only allow image formats for carousel
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(
          `Invalid file type. Carousel images must be in one of these formats: ${CAROUSEL_IMAGE_REQUIREMENTS.allowedFormats.join(', ')}. ` +
          `Received: ${file.mimetype}`
        ), false);
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
          description: `Carousel image file. Requirements:
- Formats: ${CAROUSEL_IMAGE_REQUIREMENTS.allowedFormats.join(', ')}
- Dimensions: ${CAROUSEL_IMAGE_REQUIREMENTS.minWidth}x${CAROUSEL_IMAGE_REQUIREMENTS.minHeight} to ${CAROUSEL_IMAGE_REQUIREMENTS.maxWidth}x${CAROUSEL_IMAGE_REQUIREMENTS.maxHeight} pixels
- Recommended: ${CAROUSEL_IMAGE_REQUIREMENTS.recommendedWidth}x${CAROUSEL_IMAGE_REQUIREMENTS.recommendedHeight} pixels (${CAROUSEL_IMAGE_REQUIREMENTS.recommendedAspectRatio} aspect ratio)
- Max file size: ${MAX_CAROUSEL_IMAGE_SIZE / (1024 * 1024)}MB`,
        },
      },
    },
  })
  @ApiOperation({ 
    summary: 'Upload carousel image for referral carousel',
    description: `Upload an image for the referral carousel. 
    
**Supported Formats:** ${CAROUSEL_IMAGE_REQUIREMENTS.allowedFormats.join(', ')}

**Image Dimensions:**
- Minimum: ${CAROUSEL_IMAGE_REQUIREMENTS.minWidth}x${CAROUSEL_IMAGE_REQUIREMENTS.minHeight} pixels
- Maximum: ${CAROUSEL_IMAGE_REQUIREMENTS.maxWidth}x${CAROUSEL_IMAGE_REQUIREMENTS.maxHeight} pixels
- Recommended: ${CAROUSEL_IMAGE_REQUIREMENTS.recommendedWidth}x${CAROUSEL_IMAGE_REQUIREMENTS.recommendedHeight} pixels (${CAROUSEL_IMAGE_REQUIREMENTS.recommendedAspectRatio} aspect ratio)

**File Size:** Maximum ${MAX_CAROUSEL_IMAGE_SIZE / (1024 * 1024)}MB`
  })
  async uploadCarouselImage(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    // Log request details for debugging
    logger.log(`Carousel image upload request received. Method: ${req.method}, URL: ${req.url}, Headers: ${JSON.stringify(req.headers)}`);
    
    // Check Content-Type header first
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      logger.error(`Invalid Content-Type for carousel image upload: ${contentType}. Expected multipart/form-data`);
      throw new BadRequestException(
        `Invalid Content-Type: "${contentType}". ` +
        'File uploads require "multipart/form-data" Content-Type. ' +
        'Make sure you are sending the file as FormData and not as URL-encoded form data. ' +
        'Example: Use FormData() in JavaScript or FormData in your HTTP client.'
      );
    }

    if (!file) {
      logger.error('No file provided in carousel image upload request', {
        contentType: req.headers['content-type'],
        headers: req.headers,
        body: req.body,
      });
      throw new BadRequestException(
        'No image file provided. Please select an image to upload. ' +
        'Make sure: 1) The form field is named "file", 2) You are using FormData, ' +
        '3) The Content-Type is "multipart/form-data" (should be set automatically by FormData). ' +
        `Supported formats: ${CAROUSEL_IMAGE_REQUIREMENTS.allowedFormats.join(', ')}. ` +
        `Max file size: ${MAX_CAROUSEL_IMAGE_SIZE / (1024 * 1024)}MB.`
      );
    }

    logger.log(`Uploading carousel image: ${file.originalname}, size: ${file.size} bytes, type: ${file.mimetype}`);

    try {
      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type: ${file.mimetype}. ` +
          `Carousel images must be in one of these formats: ${CAROUSEL_IMAGE_REQUIREMENTS.allowedFormats.join(', ')}.`
        );
      }

      // Validate file size
      if (file.size > MAX_CAROUSEL_IMAGE_SIZE) {
        throw new BadRequestException(
          `File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds maximum allowed size of ${MAX_CAROUSEL_IMAGE_SIZE / (1024 * 1024)}MB. ` +
          'Please compress the image or use a smaller file.'
        );
      }

      // Validate image dimensions
      let dimensions: { width: number; height: number };
      try {
        dimensions = sizeOf(file.buffer);
        logger.log(`Image dimensions: ${dimensions.width}x${dimensions.height}`);
      } catch (error: any) {
        logger.error(`Failed to read image dimensions: ${error.message}`);
        throw new BadRequestException(
          'Failed to read image dimensions. The file may be corrupted or not a valid image. ' +
          `Please ensure the image is in one of these formats: ${CAROUSEL_IMAGE_REQUIREMENTS.allowedFormats.join(', ')}.`
        );
      }

      // Validate width
      if (dimensions.width < CAROUSEL_IMAGE_REQUIREMENTS.minWidth || dimensions.width > CAROUSEL_IMAGE_REQUIREMENTS.maxWidth) {
        throw new BadRequestException(
          `Image width (${dimensions.width}px) is outside the allowed range. ` +
          `Width must be between ${CAROUSEL_IMAGE_REQUIREMENTS.minWidth}px and ${CAROUSEL_IMAGE_REQUIREMENTS.maxWidth}px. ` +
          `Recommended width: ${CAROUSEL_IMAGE_REQUIREMENTS.recommendedWidth}px.`
        );
      }

      // Validate height
      if (dimensions.height < CAROUSEL_IMAGE_REQUIREMENTS.minHeight || dimensions.height > CAROUSEL_IMAGE_REQUIREMENTS.maxHeight) {
        throw new BadRequestException(
          `Image height (${dimensions.height}px) is outside the allowed range. ` +
          `Height must be between ${CAROUSEL_IMAGE_REQUIREMENTS.minHeight}px and ${CAROUSEL_IMAGE_REQUIREMENTS.maxHeight}px. ` +
          `Recommended height: ${CAROUSEL_IMAGE_REQUIREMENTS.recommendedHeight}px.`
        );
      }

      // Check aspect ratio (warn if far from recommended)
      const aspectRatio = dimensions.width / dimensions.height;
      const recommendedRatio = 2; // 2:1
      const ratioDifference = Math.abs(aspectRatio - recommendedRatio);
      
      if (ratioDifference > 0.5) {
        logger.warn(`Image aspect ratio (${aspectRatio.toFixed(2)}) differs significantly from recommended ${CAROUSEL_IMAGE_REQUIREMENTS.recommendedAspectRatio}`);
      }

      // Upload to S3
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `carousel/${Date.now()}-${sanitizedFilename}`;
      
      logger.log(`Uploading carousel image to S3 with key: ${key}`);
      
      const result = await this.fileService.uploadFile(
        file.buffer,
        key,
        file.mimetype,
      );

      logger.log(`Carousel image uploaded successfully. URL: ${result.Location}`);

      return {
        url: result.Location,
        key: result.Key,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        dimensions: {
          width: dimensions.width,
          height: dimensions.height,
          aspectRatio: aspectRatio.toFixed(2),
        },
        requirements: {
          supportedFormats: CAROUSEL_IMAGE_REQUIREMENTS.allowedFormats,
          minDimensions: `${CAROUSEL_IMAGE_REQUIREMENTS.minWidth}x${CAROUSEL_IMAGE_REQUIREMENTS.minHeight}`,
          maxDimensions: `${CAROUSEL_IMAGE_REQUIREMENTS.maxWidth}x${CAROUSEL_IMAGE_REQUIREMENTS.maxHeight}`,
          recommendedDimensions: `${CAROUSEL_IMAGE_REQUIREMENTS.recommendedWidth}x${CAROUSEL_IMAGE_REQUIREMENTS.recommendedHeight}`,
          recommendedAspectRatio: CAROUSEL_IMAGE_REQUIREMENTS.recommendedAspectRatio,
          maxFileSize: `${MAX_CAROUSEL_IMAGE_SIZE / (1024 * 1024)}MB`,
        },
      };
    } catch (error: any) {
      logger.error(`Carousel image upload failed: ${error.message}`, error.stack);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      // Provide more specific error messages
      if (error.message && error.message.includes('S3')) {
        throw new BadRequestException(
          'Failed to upload image to storage. Please check your AWS S3 configuration or try again later.'
        );
      }
      
      throw new BadRequestException(
        `Failed to upload carousel image: ${error.message || 'Unknown error'}. ` +
        `Please ensure the image meets the requirements: ` +
        `Formats: ${CAROUSEL_IMAGE_REQUIREMENTS.allowedFormats.join(', ')}, ` +
        `Dimensions: ${CAROUSEL_IMAGE_REQUIREMENTS.minWidth}x${CAROUSEL_IMAGE_REQUIREMENTS.minHeight} to ${CAROUSEL_IMAGE_REQUIREMENTS.maxWidth}x${CAROUSEL_IMAGE_REQUIREMENTS.maxHeight}px, ` +
        `Max size: ${MAX_CAROUSEL_IMAGE_SIZE / (1024 * 1024)}MB.`
      );
    }
  }

  @Get('url/:key')
  @ApiOperation({ summary: 'Get signed URL' })
  async getSignedUrl(@Param('key') key: string) {
    const url = await this.fileService.getSignedUrl(key);
    return { url };
  }
}

