import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ProfilesService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: {
          include: {
            college: true,
            course: true,
            projects: true,
            experiences: true,
          },
        },
        companyProfile: true,
        collegeProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateBasicInfo(userId: string, data: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date;
    gender?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || !user.studentProfile) {
      throw new NotFoundException('Student profile not found');
    }

    const updated = await this.prisma.studentProfile.update({
      where: { userId },
      data,
    });

    await this.calculateProfileScore(userId);

    return updated;
  }

  async updateEducation(userId: string, data: {
    education10th?: any;
    education12th?: any;
    graduation?: any;
    postGraduation?: any;
  }) {
    const updated = await this.prisma.studentProfile.update({
      where: { userId },
      data,
    });

    await this.calculateProfileScore(userId);

    return updated;
  }

  async updateSkills(userId: string, data: {
    technicalSkills?: string[];
    softSkills?: string[];
  }) {
    const updated = await this.prisma.studentProfile.update({
      where: { userId },
      data,
    });

    await this.calculateProfileScore(userId);

    return updated;
  }

  async updateInterests(userId: string, interests: string[]) {
    // Store interests in metadata or create separate table
    const updated = await this.prisma.studentProfile.update({
      where: { userId },
      data: {
        // Add interests field if needed
      },
    });

    await this.calculateProfileScore(userId);

    return updated;
  }

  async uploadProfileImage(userId: string, imageUrl: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { profileImage: imageUrl },
    });

    await this.prisma.studentProfile.update({
      where: { userId },
      data: { profileImage: imageUrl },
    });

    await this.calculateProfileScore(userId);

    return { profileImage: imageUrl };
  }

  async calculateProfileScore(userId: string): Promise<number> {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!profile) return 0;

    let score = 0;

    // Basic Info (20%)
    if (profile.firstName && profile.lastName) score += 10;
    if (profile.dateOfBirth) score += 5;
    if (profile.gender) score += 5;

    // Education (30%)
    if (profile.education10th) score += 7.5;
    if (profile.education12th) score += 7.5;
    if (profile.graduation) score += 10;
    if (profile.postGraduation) score += 5;

    // Skills (20%)
    if (profile.technicalSkills.length > 0) score += 10;
    if (profile.softSkills.length > 0) score += 10;

    // Profile Image (10%)
    if (profile.profileImage) score += 10;

    // Additional (20%)
    if (profile.collegeId) score += 5;
    if (profile.courseId) score += 5;
    if (profile.address) score += 5;
    if (profile.city && profile.state) score += 5;

    const finalScore = Math.min(100, score);

    await this.prisma.studentProfile.update({
      where: { userId },
      data: { profileScore: finalScore },
    });

    return finalScore;
  }

  async getProfileCompletion(userId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { profileScore: true },
    });

    return {
      completion: profile?.profileScore || 0,
      score: profile?.profileScore || 0,
    };
  }
}

