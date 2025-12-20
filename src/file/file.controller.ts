import { Controller, Post, Get, Param, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileService } from './file.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Files')
@Controller('files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file (images, PDFs, etc.)' })
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file provided');
    }

    // Validate file type
    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} not allowed. Allowed types: images (JPEG, PNG, GIF, WebP) and PDFs`);
    }

    // Determine folder based on file type
    const folder = file.mimetype === 'application/pdf' ? 'certificates' : 'uploads';
    const key = `${folder}/${Date.now()}-${file.originalname}`;
    
    const result = await this.fileService.uploadFile(
      file.buffer,
      key,
      file.mimetype,
    );

    return {
      success: true,
      data: {
        url: result.Location,
        key: result.Key,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    };
  }

  @Post('upload/certificate')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload certificate or degree PDF' })
  async uploadCertificate(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('No file provided');
    }

    // Only allow PDFs for certificates
    if (file.mimetype !== 'application/pdf') {
      throw new Error('Only PDF files are allowed for certificates');
    }

    const key = `certificates/${Date.now()}-${file.originalname}`;
    const result = await this.fileService.uploadFile(
      file.buffer,
      key,
      file.mimetype,
    );

    return {
      success: true,
      data: {
        url: result.Location,
        key: result.Key,
        fileName: file.originalname,
        fileSize: file.size,
        type: 'certificate',
      },
    };
  }

  @Get('url/:key')
  @ApiOperation({ summary: 'Get signed URL' })
  async getSignedUrl(@Param('key') key: string) {
    const url = await this.fileService.getSignedUrl(key);
    return { url };
  }
}

