import { SetMetadata } from '@nestjs/common';

export const Permission = (resource: string, action: string) =>
  SetMetadata('permission', { resource, action });

