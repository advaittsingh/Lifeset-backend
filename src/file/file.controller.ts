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
  @ApiOperation({ summary: 'Upload file' })
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    const key = `uploads/${Date.now()}-${file.originalname}`;
    const result = await this.fileService.uploadFile(
      file.buffer,
      key,
      file.mimetype,
    );

    return {
      url: result.Location,
      key: result.Key,
    };
  }

  @Get('url/:key')
  @ApiOperation({ summary: 'Get signed URL' })
  async getSignedUrl(@Param('key') key: string) {
    const url = await this.fileService.getSignedUrl(key);
    return { url };
  }
}

