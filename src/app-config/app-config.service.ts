import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AppConfigService {
  private readonly APP_ICON_KEY = 'APP_ICON';
  private readonly REFERRAL_CAROUSEL_KEY = 'REFERRAL_CAROUSEL';

  constructor(private prisma: PrismaService) {}

  async getAppIconConfig() {
    const config = await this.prisma.appConfig.findUnique({
      where: { key: this.APP_ICON_KEY },
    });

    if (!config) {
      return {
        ios: null,
        android: null,
        default: null,
        updatedAt: null,
      };
    }

    const value = config.value as any;
    return {
      ios: value?.ios || null,
      android: value?.android || null,
      default: value?.default || null,
      updatedAt: config.updatedAt,
    };
  }

  async updateAppIcon(data: {
    ios?: string;
    android?: string;
    default?: string;
  }) {
    const existing = await this.prisma.appConfig.findUnique({
      where: { key: this.APP_ICON_KEY },
    });

    // Merge with existing values
    const existingValue = existing?.value as any || {};
    const newValue = {
      ios: data.ios !== undefined ? data.ios : existingValue.ios,
      android: data.android !== undefined ? data.android : existingValue.android,
      default: data.default !== undefined ? data.default : existingValue.default,
    };

    if (existing) {
      return this.prisma.appConfig.update({
        where: { key: this.APP_ICON_KEY },
        data: {
          value: newValue as any,
        },
      });
    } else {
      return this.prisma.appConfig.create({
        data: {
          key: this.APP_ICON_KEY,
          value: newValue as any,
        },
      });
    }
  }

  async getReferralCarousel() {
    const config = await this.prisma.appConfig.findUnique({
      where: { key: this.REFERRAL_CAROUSEL_KEY },
    });

    if (!config) {
      return {
        items: [],
        updatedAt: null,
      };
    }

    const value = config.value as any;
    return {
      items: value?.items || [],
      updatedAt: config.updatedAt,
    };
  }

  async updateReferralCarousel(data: {
    items: Array<{
      id?: string;
      type: 'image' | 'topPerformer';
      imageUrl?: string;
      title?: string;
      subtitle?: string;
      redirectLink?: string;
      order?: number;
    }>;
  }) {
    const existing = await this.prisma.appConfig.findUnique({
      where: { key: this.REFERRAL_CAROUSEL_KEY },
    });

    const newValue = {
      items: data.items.map((item, index) => ({
        ...item,
        id: item.id || `item-${Date.now()}-${index}`,
        order: item.order !== undefined ? item.order : index,
      })),
    };

    if (existing) {
      return this.prisma.appConfig.update({
        where: { key: this.REFERRAL_CAROUSEL_KEY },
        data: {
          value: newValue as any,
        },
      });
    } else {
      return this.prisma.appConfig.create({
        data: {
          key: this.REFERRAL_CAROUSEL_KEY,
          value: newValue as any,
        },
      });
    }
  }

}
