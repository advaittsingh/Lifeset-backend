import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';

export class ClearCacheDto {
  @ApiProperty({ required: false, description: 'Cache key pattern (e.g., "user:*")' })
  @IsOptional()
  @IsString()
  pattern?: string;
}

export class RecoveryActionDto {
  @ApiProperty({ description: 'Action to perform', enum: ['restart-queue', 'clear-queue', 'restart-redis', 'gc', 'reconnect-db'] })
  @IsString()
  action: string;

  @ApiProperty({ required: false, description: 'Additional parameters' })
  @IsOptional()
  params?: Record<string, any>;
}

export class AlertConfigDto {
  @ApiProperty({ description: 'Alert type', enum: ['cpu', 'memory', 'disk', 'error', 'latency'] })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Threshold value' })
  @IsNumber()
  threshold: number;

  @ApiProperty({ description: 'Enable alert' })
  @IsBoolean()
  enabled: boolean;
}





