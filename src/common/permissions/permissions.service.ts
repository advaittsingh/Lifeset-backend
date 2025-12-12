import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async getUserPermissions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        adminProfile: true,
      },
    });

    if (!user || !user.adminProfile) {
      return [];
    }

    const permissions = user.adminProfile.permissions as any;
    return permissions || [];
  }

  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    
    if (permissions.length === 0) {
      return false;
    }

    return permissions.some(
      (p: any) => p.resource === resource && p.actions.includes(action),
    );
  }
}

