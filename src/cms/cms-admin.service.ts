import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CmsAdminService {
  constructor(private prisma: PrismaService) {}

  // ========== Current Affairs & General Knowledge ==========
  async getCurrentAffairs(filters?: any) {
    const where: any = { postType: 'CURRENT_AFFAIRS' };
    if (filters?.category) where.categoryId = filters.category;
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.isActive !== undefined) where.isActive = filters.isActive === 'true';

    return this.prisma.post.findMany({
      where,
      include: { user: true, category: true },
      orderBy: { createdAt: 'desc' },
      skip: filters?.page ? (filters.page - 1) * (filters.limit || 20) : 0,
      take: filters?.limit || 20,
    });
  }

  async createCurrentAffair(data: any, userId: string) {
    const { metadata, ...postData } = data;
    return this.prisma.post.create({
      data: {
        ...postData,
        userId,
        postType: 'CURRENT_AFFAIRS',
        metadata: metadata ? { ...metadata } : undefined,
      },
    });
  }

  async updateCurrentAffair(id: string, data: any) {
    const { metadata, ...postData } = data;
    // Merge metadata if it exists
    if (metadata) {
      const existing = await this.prisma.post.findUnique({ where: { id } });
      const existingMetadata = (existing?.metadata as any) || {};
      postData.metadata = { ...existingMetadata, ...metadata };
    }
    return this.prisma.post.update({ where: { id }, data: postData });
  }

  async deleteCurrentAffair(id: string) {
    return this.prisma.post.update({ where: { id }, data: { isActive: false } });
  }

  // ========== General Knowledge ==========
  async getGeneralKnowledge(filters?: any) {
    const where: any = { 
      postType: 'COLLEGE_FEED',
    };
    if (filters?.category) where.categoryId = filters.category;
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.isActive !== undefined) where.isActive = filters.isActive === 'true';

    const allPosts = await this.prisma.post.findMany({
      where,
      include: { user: true, category: true },
      orderBy: { createdAt: 'desc' },
      skip: filters?.page ? (filters.page - 1) * (filters.limit || 20) : 0,
      take: (filters?.limit || 20) * 2,
    });

    // Filter by metadata type
    const filtered = allPosts.filter((post: any) => {
      const metadata = post.metadata as any;
      return metadata?.type === 'GENERAL_KNOWLEDGE';
    });

    return filtered.slice(0, filters?.limit || 20);
  }

  async createGeneralKnowledge(data: any, userId: string) {
    const { metadata, ...postData } = data;
    return this.prisma.post.create({
      data: {
        ...postData,
        userId,
        postType: 'COLLEGE_FEED',
        metadata: {
          ...(metadata || {}),
          type: 'GENERAL_KNOWLEDGE',
        },
      },
    });
  }

  async updateGeneralKnowledge(id: string, data: any) {
    const { metadata, ...postData } = data;
    // Merge metadata if it exists
    if (metadata) {
      const existing = await this.prisma.post.findUnique({ where: { id } });
      const existingMetadata = (existing?.metadata as any) || {};
      postData.metadata = {
        ...existingMetadata,
        ...metadata,
        type: 'GENERAL_KNOWLEDGE',
      };
    }
    return this.prisma.post.update({ where: { id }, data: postData });
  }

  async deleteGeneralKnowledge(id: string) {
    return this.prisma.post.update({ where: { id }, data: { isActive: false } });
  }

  // ========== MCQ Management ==========
  async getMcqQuestions(filters?: any) {
    const where: any = {};
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.search) {
      where.OR = [
        { question: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.mcqQuestion.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: 'desc' },
      skip: filters?.page ? (filters.page - 1) * (filters.limit || 20) : 0,
      take: filters?.limit || 20,
    });
  }

  async createMcqQuestion(data: any) {
    return this.prisma.mcqQuestion.create({ data });
  }

  async updateMcqQuestion(id: string, data: any) {
    return this.prisma.mcqQuestion.update({ where: { id }, data });
  }

  async deleteMcqQuestion(id: string) {
    return this.prisma.mcqQuestion.delete({ where: { id } });
  }

  async getMcqCategories() {
    return this.prisma.mcqCategory.findMany({ orderBy: { name: 'asc' } });
  }

  async createMcqCategory(data: any) {
    return this.prisma.mcqCategory.create({ data });
  }

  // ========== Know Yourself (Personality Quiz) ==========
  async getPersonalityQuestions() {
    return this.prisma.personalityQuiz.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  async createPersonalityQuestion(data: any) {
    return this.prisma.personalityQuiz.create({ data });
  }

  async updatePersonalityQuestion(id: string, data: any) {
    return this.prisma.personalityQuiz.update({ where: { id }, data });
  }

  async deletePersonalityQuestion(id: string) {
    return this.prisma.personalityQuiz.update({ where: { id }, data: { isActive: false } });
  }

  // ========== Daily Digest ==========
  async getDailyDigests(filters?: any) {
    const where: any = { postType: 'DIGEST' };
    if (filters?.date) where.date = new Date(filters.date);
    if (filters?.isPublished !== undefined) where.isPublished = filters.isPublished === 'true';

    return this.prisma.post.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDailyDigest(data: any, userId: string) {
    return this.prisma.post.create({
      data: {
        ...data,
        userId,
        postType: 'DIGEST',
      },
    });
  }

  // ========== College Events ==========
  async getCollegeEvents(filters?: any) {
    const where: any = { postType: 'EVENT' };
    if (filters?.collegeId) where.user = { collegeProfile: { id: filters.collegeId } };
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.post.findMany({
      where,
      include: { user: { include: { collegeProfile: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCollegeEvent(data: any, userId: string) {
    return this.prisma.post.create({
      data: {
        ...data,
        userId,
        postType: 'EVENT',
      },
    });
  }

  // ========== Govt Vacancies ==========
  async getGovtVacancies(filters?: any) {
    const where: any = { postType: 'JOB' };
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.jobPost.findMany({
      where,
      include: {
        post: { include: { user: true } },
        company: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ========== Jobs Management ==========
  async getJobs(filters?: any) {
    const where: any = {};
    if (filters?.search) {
      where.OR = [
        { jobTitle: { contains: filters.search, mode: 'insensitive' } },
        { jobDescription: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.status) where.status = filters.status;

    return this.prisma.jobPost.findMany({
      where,
      include: {
        post: { include: { user: true } },
        company: true,
        _count: { select: { jobApplications: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateJob(id: string, data: any) {
    return this.prisma.jobPost.update({ where: { id }, data });
  }

  // ========== Internships ==========
  async getInternships(filters?: any) {
    const where: any = { jobType: 'INTERNSHIP' };
    if (filters?.search) {
      where.OR = [
        { jobTitle: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.jobPost.findMany({
      where,
      include: {
        post: { include: { user: true } },
        company: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ========== Freelancing ==========
  async getFreelancing(filters?: any) {
    const where: any = { jobType: 'FREELANCE' };
    if (filters?.search) {
      where.OR = [
        { jobTitle: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.jobPost.findMany({
      where,
      include: {
        post: { include: { user: true } },
        company: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ========== College Feeds ==========
  async getCollegeFeeds(filters?: any) {
    const where: any = {};
    if (filters?.collegeId) {
      where.user = { studentProfile: { collegeId: filters.collegeId } };
    }
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.post.findMany({
      where,
      include: {
        user: { include: { studentProfile: { include: { college: true } } } },
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ========== Students Community ==========
  async getCommunityPosts(filters?: any) {
    const where: any = {};
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.post.findMany({
      where,
      include: {
        user: { include: { studentProfile: true } },
        category: true,
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async moderateCommunityPost(id: string, action: 'approve' | 'reject' | 'delete') {
    if (action === 'delete') {
      return this.prisma.post.update({ where: { id }, data: { isActive: false } });
    }
    return this.prisma.post.update({ where: { id }, data: { isActive: action === 'approve' } });
  }

  // ========== Feed Management ==========
  async getFeeds(filters?: any) {
    const where: any = {};
    if (filters?.postType) where.postType = filters.postType;
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.isActive !== undefined) where.isActive = filters.isActive === 'true';

    return this.prisma.post.findMany({
      where,
      include: { user: true, category: true },
      orderBy: { createdAt: 'desc' },
      skip: filters?.page ? (filters.page - 1) * (filters.limit || 20) : 0,
      take: filters?.limit || 20,
    });
  }

  async updateFeed(id: string, data: any) {
    return this.prisma.post.update({ where: { id }, data });
  }

  async deleteFeed(id: string) {
    return this.prisma.post.update({ where: { id }, data: { isActive: false } });
  }

  // ========== User Management ==========
  async getUsers(filters?: any) {
    const where: any = {};
    if (filters?.userType) where.userType = filters.userType;
    if (filters?.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { mobile: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      include: {
        studentProfile: true,
        companyProfile: true,
        collegeProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUser(id: string, data: any) {
    return this.prisma.user.update({ where: { id }, data });
  }

  // ========== Institute Management ==========
  async getInstitutes(filters?: any) {
    const where: any = {};
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
        { state: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.isActive !== undefined) where.isActive = filters.isActive === 'true';

    return this.prisma.college.findMany({
      where,
      include: {
        _count: {
          select: {
            students: true,
            courses: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createInstitute(data: any) {
    return this.prisma.college.create({ data });
  }

  async updateInstitute(id: string, data: any) {
    return this.prisma.college.update({ where: { id }, data });
  }

  async deleteInstitute(id: string) {
    return this.prisma.college.update({ where: { id }, data: { isActive: false } });
  }

  // ========== Course Master Data ==========
  async getCourseMasterData() {
    return this.prisma.courseCategory.findMany({
      include: {
        _count: { select: { courses: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createCourseCategory(data: any) {
    return this.prisma.courseCategory.create({ data });
  }

  async updateCourseCategory(id: string, data: any) {
    return this.prisma.courseCategory.update({ where: { id }, data });
  }

  async getCoursesByInstitute(instituteId: string) {
    return this.prisma.course.findMany({
      where: { collegeId: instituteId },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async createCourse(data: any) {
    return this.prisma.course.create({ data });
  }

  async updateCourse(id: string, data: any) {
    return this.prisma.course.update({ where: { id }, data });
  }

  // ========== Wall Categories ==========
  async getWallCategories() {
    return this.prisma.wallCategory.findMany({
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createWallCategory(data: any) {
    return this.prisma.wallCategory.create({
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive !== undefined ? data.isActive : true,
        // Note: categoryFor and parentCategoryId would need schema changes to support
        // Currently, WallCategory model doesn't have a metadata field in the schema
      },
    });
  }

  async updateWallCategory(id: string, data: any) {
    return this.prisma.wallCategory.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive !== undefined ? data.isActive : true,
        // Note: categoryFor and parentCategoryId would need schema changes to support
        // Currently, WallCategory model doesn't have a metadata field in the schema
      },
    });
  }

  async deleteWallCategory(id: string) {
    return this.prisma.wallCategory.delete({ where: { id } });
  }
}
