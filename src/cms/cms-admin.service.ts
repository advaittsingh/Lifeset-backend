import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { countWords, countPlainTextCharacters } from '../common/utils/validation.helpers';
import { updateCategoryPostCount } from '../common/utils/category.helpers';
import { Prisma } from '@prisma/client';

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
    // Validate description word count (max 60 words) - HTML tags are stripped automatically
    if (data.description) {
      const wordCount = countWords(data.description);
      if (wordCount > 60) {
        throw new BadRequestException('Description must be 60 words or less (HTML tags are not counted)');
      }
    }

    // Extract language from top-level if provided, merge into metadata
    // Also extract isPublished since it's not in Prisma schema (only isActive exists)
    const { metadata, language, isPublished, ...postData } = data;
    
    // Build metadata object - merge language from top-level if provided
    const finalMetadata = {
      ...(metadata || {}),
      postType: 'Current Affairs',
      // If language is provided at top-level, use it (metadata.language takes precedence if both exist)
      ...(language && !metadata?.language ? { language } : {}),
      // Store articleId in metadata for MCQ linking (will be set after creation)
      articleId: undefined,
      // Store isPublished in metadata since it's not a direct field in Post model
      ...(isPublished !== undefined ? { isPublished } : {}),
    };
    
    // Set isActive based on isPublished: if published, make it active immediately
    // If isPublished is true, set isActive to true; if false or undefined, default to true (Post model default)
    const isActive = isPublished === true ? true : (postData.isActive !== undefined ? postData.isActive : true);
    
    // Create the post (isPublished is filtered out since it's not in Prisma schema)
    const post = await this.prisma.post.create({
      data: {
        ...postData,
        userId,
        postType: 'CURRENT_AFFAIRS',
        isActive,
        metadata: finalMetadata,
      },
    });

    // Update metadata with articleId (post ID) for MCQ linking
    const updatedMetadata = {
      ...(post.metadata as any || {}),
      articleId: post.id,
    };

    const updatedPost = await this.prisma.post.update({
      where: { id: post.id },
      data: { metadata: updatedMetadata },
    });

    return {
      ...updatedPost,
      articleId: post.id, // Return articleId in response
    };
  }

  async getCurrentAffairById(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id, postType: 'CURRENT_AFFAIRS' },
      include: { 
        user: true, 
        category: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Current affair not found');
    }

    // Extract metadata fields and flatten for frontend
    const metadata = (post.metadata as any) || {};
    const { 
      language, 
      isPublished, 
      postType: metadataPostType,
      articleId: metadataArticleId,
      ...otherMetadata 
    } = metadata;

    return {
      ...post,
      // Flatten language and isPublished from metadata to top level
      language: language || undefined,
      isPublished: isPublished !== undefined ? isPublished : post.isActive,
      // Return all metadata fields (subCategoryId, chapterId, location, dates, etc.)
      metadata: {
        ...otherMetadata,
        // Include articleId if it exists
        ...(metadataArticleId && { articleId: metadataArticleId }),
      },
    };
  }

  async updateCurrentAffair(id: string, data: any) {
    // Validate description word count if provided (max 60 words) - HTML tags are stripped automatically
    if (data.description) {
      const wordCount = countWords(data.description);
      if (wordCount > 60) {
        throw new BadRequestException('Description must be 60 words or less (HTML tags are not counted)');
      }
    }

    // Extract language from top-level if provided, merge into metadata
    // Also extract isPublished since it's not in Prisma schema (only isActive exists)
    const { metadata, language, isPublished, ...postData } = data;
    
    // Build metadata object - merge language from top-level if provided
    let finalMetadata = metadata;
    if (language || metadata || isPublished !== undefined) {
      const existingPost = await this.prisma.post.findUnique({
        where: { id },
        select: { metadata: true },
      });
      
      const existingMetadata = (existingPost?.metadata as any) || {};
      finalMetadata = {
        ...existingMetadata,
        ...metadata,
        // If language is provided at top-level, use it (metadata.language takes precedence if both exist)
        ...(language && !metadata?.language ? { language } : {}),
        // Update isPublished if provided
        ...(isPublished !== undefined ? { isPublished } : {}),
      };
    }

    const updateData: any = {
      ...postData,
    };
    
    if (finalMetadata !== undefined) {
      updateData.metadata = finalMetadata;
    }

    return this.prisma.post.update({
      where: { id },
      data: updateData,
    });
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

  async getGeneralKnowledgeById(id: string) {
    const post = await this.prisma.post.findFirst({
      where: { 
        id,
        postType: 'COLLEGE_FEED',
      },
      include: { 
        user: true, 
        category: true,
      },
    });

    if (!post) {
      throw new NotFoundException('General knowledge article not found');
    }

    // Check if it's actually a general knowledge article
    const metadata = (post.metadata as any) || {};
    if (metadata?.type !== 'GENERAL_KNOWLEDGE') {
      throw new NotFoundException('General knowledge article not found');
    }

    // Extract metadata fields and flatten for frontend
    const { 
      language, 
      isPublished, 
      type, 
      postType: metadataPostType,
      articleId: metadataArticleId,
      ...otherMetadata 
    } = metadata;

    return {
      ...post,
      // Flatten language and isPublished from metadata to top level
      language: language || undefined,
      isPublished: isPublished !== undefined ? isPublished : post.isActive,
      // Return all metadata fields (subCategoryId, chapterId, location, dates, etc.)
      metadata: {
        ...otherMetadata,
        // Include articleId if it exists
        ...(metadataArticleId && { articleId: metadataArticleId }),
      },
    };
  }

  async createGeneralKnowledge(data: any, userId: string) {
    // Validate description word count (max 60 words) - HTML tags are stripped automatically
    if (data.description) {
      const wordCount = countWords(data.description);
      if (wordCount > 60) {
        throw new BadRequestException('Description must be 60 words or less (HTML tags are not counted)');
      }
    }

    // Extract language from top-level if provided, merge into metadata
    // Also extract isPublished since it's not in Prisma schema (only isActive exists)
    const { metadata, language, isPublished, ...postData } = data;
    
    // Build metadata object - merge language from top-level if provided
    const finalMetadata = {
      ...(metadata || {}),
      type: 'GENERAL_KNOWLEDGE',
      postType: 'General Knowledge',
      // If language is provided at top-level, use it (metadata.language takes precedence if both exist)
      ...(language && !metadata?.language ? { language } : {}),
      // Store articleId in metadata for MCQ linking (will be set after creation)
      articleId: undefined,
      // Store isPublished in metadata since it's not a direct field in Post model
      ...(isPublished !== undefined ? { isPublished } : {}),
    };
    
    // Set isActive based on isPublished: if published, make it active immediately
    // If isPublished is true, set isActive to true; if false or undefined, default to true (Post model default)
    const isActive = isPublished === true ? true : (postData.isActive !== undefined ? postData.isActive : true);
    
    // Create the post (isPublished is filtered out since it's not in Prisma schema)
    const post = await this.prisma.post.create({
      data: {
        ...postData,
        userId,
        postType: 'COLLEGE_FEED',
        isActive,
        metadata: finalMetadata,
      },
    });

    // Update metadata with articleId (post ID) for MCQ linking
    const updatedMetadata = {
      ...(post.metadata as any || {}),
      articleId: post.id,
    };

    const updatedPost = await this.prisma.post.update({
      where: { id: post.id },
      data: { metadata: updatedMetadata },
    });

    return {
      ...updatedPost,
      articleId: post.id, // Return articleId in response
    };
  }

  async updateGeneralKnowledge(id: string, data: any) {
    // Validate description word count if provided (max 60 words) - HTML tags are stripped automatically
    if (data.description) {
      const wordCount = countWords(data.description);
      if (wordCount > 60) {
        throw new BadRequestException('Description must be 60 words or less (HTML tags are not counted)');
      }
    }

    // Extract language from top-level if provided, merge into metadata
    // Also extract isPublished since it's not in Prisma schema (only isActive exists)
    const { metadata, language, isPublished, ...postData } = data;
    
    // Build metadata object - merge language from top-level if provided
    let finalMetadata = metadata;
    if (language || metadata || isPublished !== undefined) {
      const existingPost = await this.prisma.post.findUnique({
        where: { id },
        select: { metadata: true, id: true },
      });
      
      const existingMetadata = (existingPost?.metadata as any) || {};
      finalMetadata = {
        ...existingMetadata,
        ...metadata,
        type: 'GENERAL_KNOWLEDGE',
        postType: 'General Knowledge',
        // If language is provided at top-level, use it (metadata.language takes precedence if both exist)
        ...(language && !metadata?.language ? { language } : {}),
        // Preserve articleId if it exists, otherwise use post id
        articleId: existingMetadata.articleId || existingPost?.id || id,
        // Update isPublished if provided
        ...(isPublished !== undefined ? { isPublished } : {}),
      };
    }

    const updateData: any = {
      ...postData,
    };
    
    if (finalMetadata !== undefined) {
      updateData.metadata = finalMetadata;
    }

    return this.prisma.post.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteGeneralKnowledge(id: string) {
    return this.prisma.post.update({ where: { id }, data: { isActive: false } });
  }

  // ========== MCQ Management ==========
  async getMcqQuestions(filters?: any) {
    const where: any = {};
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.articleId) where.articleId = filters.articleId; // Support filtering by articleId
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
    const { articleId, metadata, categoryId, ...mcqData } = data;
    
    // Validate categoryId is provided (required field)
    if (!categoryId) {
      throw new BadRequestException('categoryId is required for MCQ questions');
    }
    
    // Prepare metadata with article context
    const mcqMetadata = metadata || {};
    if (articleId) {
      mcqMetadata.articleId = articleId;
    }

    // Create MCQ with articleId in both column and metadata
    return this.prisma.mcqQuestion.create({
      data: {
        ...mcqData,
        categoryId, // Ensure categoryId is included
        articleId: articleId || undefined,
        metadata: Object.keys(mcqMetadata).length > 0 ? mcqMetadata : undefined,
      },
    });
  }

  async updateMcqQuestion(id: string, data: any) {
    return this.prisma.mcqQuestion.update({ where: { id }, data });
  }

  async deleteMcqQuestion(id: string) {
    return this.prisma.mcqQuestion.delete({ where: { id } });
  }

  async getMcqCategories() {
    // MCQ questions now use WallCategory instead of McqCategory
    // Return wall categories that can be used for MCQ
    return this.prisma.wallCategory.findMany({ 
      where: { isActive: true },
      orderBy: { name: 'asc' } 
    });
  }

  async createMcqCategory(data: any) {
    // MCQ questions now use WallCategory instead of McqCategory
    // Create a wall category for MCQ use
    return this.prisma.wallCategory.create({ 
      data: {
        ...data,
        categoryFor: 'MCQ', // Mark as MCQ category
      }
    });
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
  async getWallCategories(filters?: { parentId?: string; categoryFor?: string; onlyParents?: boolean }) {
    // According to requirements: Default behavior returns ONLY parent categories (parentCategoryId IS NULL)
    try {
      let categories: any[] = [];
      
      // Build query based on filters - use raw SQL for better control and to handle missing columns
      try {
        // Check if parentCategoryId column exists. If it doesn't, we can't distinguish parents vs sub-categories.
        const hasParentCategoryId = await this.prisma.$queryRaw`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'WallCategory' 
          AND column_name = 'parentCategoryId'
          LIMIT 1
        ` as any[];

        const hasNewFields = hasParentCategoryId && hasParentCategoryId.length > 0;

        // If the column is missing, fail fast with a clear message so we don't mis-classify sub-categories as parents.
        if (!hasNewFields) {
          throw new BadRequestException(
            'WallCategory schema missing parentCategoryId. Please run migrations (npx prisma migrate deploy) so parent/sub-category separation works.'
          );
        }

        // New fields exist - use strict filtering
        if (filters?.parentId) {
          // Sub-categories for specific parent
          categories = await this.prisma.$queryRaw`
            SELECT id, name, description, "isActive", "createdAt", "updatedAt",
                   "categoryFor", "parentCategoryId", "postCount", metadata
            FROM "WallCategory"
            WHERE "parentCategoryId" = ${filters.parentId}
            ${filters?.categoryFor ? Prisma.sql`AND "categoryFor" = ${filters.categoryFor}` : Prisma.empty}
            ORDER BY name ASC
          ` as any[];
        } else if (filters?.onlyParents === false) {
          // All categories (parents + subs)
          categories = await this.prisma.$queryRaw`
            SELECT id, name, description, "isActive", "createdAt", "updatedAt",
                   "categoryFor", "parentCategoryId", "postCount", metadata
            FROM "WallCategory"
            ${filters?.categoryFor ? Prisma.sql`WHERE "categoryFor" = ${filters.categoryFor}` : Prisma.empty}
            ORDER BY name ASC
          ` as any[];
        } else {
          // Default: only parent categories
          categories = await this.prisma.$queryRaw`
            SELECT id, name, description, "isActive", "createdAt", "updatedAt",
                   "categoryFor", "parentCategoryId", "postCount", metadata
            FROM "WallCategory"
            WHERE "parentCategoryId" IS NULL
            ${filters?.categoryFor ? Prisma.sql`AND "categoryFor" = ${filters.categoryFor}` : Prisma.empty}
            ORDER BY name ASC
          ` as any[];
        }
      } catch (prismaError: any) {
        // If Prisma fails, try simple raw SQL
        console.warn('Prisma query failed, trying simple raw SQL:', prismaError.message);
        
        try {
          // Fallback: default to parents only using base fields
          categories = await this.prisma.$queryRaw`
            SELECT id, name, description, "isActive", "createdAt", "updatedAt"
            FROM "WallCategory"
            WHERE "parentCategoryId" IS NULL
            ORDER BY name ASC
          ` as any[];
        } catch (rawError: any) {
          if (rawError.message?.includes('does not exist') || rawError.message?.includes('relation')) {
            console.warn('WallCategory table does not exist, returning empty array');
            return [];
          }
          throw rawError;
        }
      }

      // Get post counts and sub-category counts for all categories
      const categoriesWithCounts = await Promise.all(
        categories.map(async (cat: any) => {
          try {
            const postCount = await this.prisma.post.count({
              where: { categoryId: cat.id, isActive: true },
            });

            // Get sub-category count if this is a parent category (parentCategoryId is null)
            let subCategoryCount = 0;
            const isParent = !cat.parentCategoryId || cat.parentCategoryId === null || cat.parentCategoryId === '';
            
            if (isParent) {
              try {
                // Check if parentCategoryId column exists before querying
                const hasParentCategoryId = await this.prisma.$queryRaw`
                  SELECT column_name 
                  FROM information_schema.columns 
                  WHERE table_name = 'WallCategory' 
                  AND column_name = 'parentCategoryId'
                  LIMIT 1
                ` as any[];

                if (hasParentCategoryId && hasParentCategoryId.length > 0) {
                  subCategoryCount = await this.prisma.wallCategory.count({
                    where: { 
                      parentCategoryId: cat.id,
                      isActive: true,
                    },
                  });
                }
              } catch (subCountError: any) {
                // If query fails, subCategoryCount remains 0
                console.warn(`Failed to get sub-category count for category ${cat.id}:`, subCountError.message);
              }
            }

            return {
              id: cat.id,
              name: cat.name,
              description: cat.description,
              categoryFor: cat.categoryFor ?? null,
              parentCategoryId: cat.parentCategoryId ?? null, // MUST be null, not undefined - Critical field per requirements
              isActive: cat.isActive,
              postCount: cat.postCount ?? postCount,
              subCategoryCount, // For parent categories only - count of sub-categories
              createdAt: cat.createdAt,
              updatedAt: cat.updatedAt,
            };
          } catch (countError: any) {
            console.warn(`Failed to get post count for category ${cat.id}:`, countError);
            return {
              id: cat.id,
              name: cat.name,
              description: cat.description,
              categoryFor: cat.categoryFor ?? null,
              parentCategoryId: cat.parentCategoryId ?? null,
              isActive: cat.isActive,
              postCount: 0,
              subCategoryCount: 0,
              createdAt: cat.createdAt,
              updatedAt: cat.updatedAt,
            };
          }
        })
      );

      return categoriesWithCounts;
    } catch (error: any) {
      console.error('Error fetching wall categories:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        meta: error?.meta,
        stack: error?.stack,
        name: error?.name,
      });
      
      // Provide more helpful error messages based on error type
      const errorMessage = error?.message || 'Unknown error';
      const errorCode = error?.code || '';
      
      // Database connection errors
      if (errorMessage.includes('P1001') || errorMessage.includes('Can\'t reach database') || errorMessage.includes('connection')) {
        throw new BadRequestException('Database connection error. Please check DATABASE_URL environment variable and database server status.');
      }
      
      // Table/relation doesn't exist
      if (errorMessage.includes('does not exist') || errorMessage.includes('relation') || errorMessage.includes('Unknown column') || errorCode === 'P2025') {
        throw new BadRequestException('WallCategory table may not exist. Please run database migrations: `npx prisma migrate deploy`');
      }
      
      // Prisma schema mismatch
      if (errorMessage.includes('Unknown arg') || errorMessage.includes('Invalid value') || errorCode === 'P2009') {
        throw new BadRequestException('Database schema mismatch. Please run database migrations: `npx prisma migrate deploy`');
      }
      
      // Generic Prisma errors
      if (errorCode?.startsWith('P')) {
        throw new BadRequestException(`Database error (${errorCode}): ${errorMessage}`);
      }
      
      // Re-throw with original error message for debugging
      throw new BadRequestException(`Failed to fetch wall categories: ${errorMessage}`);
    }
  }

  async createWallCategory(data: any) {
    // According to requirements: If parentCategoryId is null → create parent, if provided → create sub-category
    let parentCategoryId: string | null = null;
    
    // Explicitly set to null if not provided or empty string
    if (data.parentCategoryId !== undefined && data.parentCategoryId !== null && data.parentCategoryId !== '') {
      parentCategoryId = data.parentCategoryId;
      
      // Validate parent category exists and is a parent (not a sub-category)
      try {
        // Check if parentCategoryId column exists
        const hasParentCategoryId = await this.prisma.$queryRaw`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'WallCategory' 
          AND column_name = 'parentCategoryId'
          LIMIT 1
        ` as any[];

        if (!hasParentCategoryId || hasParentCategoryId.length === 0) {
          throw new BadRequestException(
            'WallCategory schema missing parentCategoryId. Please run migrations (npx prisma migrate deploy) before creating sub-categories.'
          );
        }

        if (hasParentCategoryId && hasParentCategoryId.length > 0) {
          // New fields exist - use proper validation
          const parent = await this.prisma.$queryRaw`
            SELECT id, name, "parentCategoryId"
            FROM "WallCategory"
            WHERE id = ${parentCategoryId}
            AND ("parentCategoryId" IS NULL OR "parentCategoryId" = '')
            LIMIT 1
          ` as any[];

          if (!parent || parent.length === 0) {
            throw new NotFoundException(`Parent category with ID ${parentCategoryId} not found or is not a parent category`);
          }
        } else {
          // New fields don't exist - just check if category exists
          const parent = await this.prisma.$queryRaw`
            SELECT id, name
            FROM "WallCategory"
            WHERE id = ${parentCategoryId}
            LIMIT 1
          ` as any[];

          if (!parent || parent.length === 0) {
            throw new NotFoundException(`Parent category with ID ${parentCategoryId} not found`);
          }
        }

        // Prevent circular reference (category cannot be its own parent)
        if (parentCategoryId === data.id) {
          throw new ConflictException('A category cannot be its own parent');
        }
      } catch (error: any) {
        if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof BadRequestException) {
          throw error;
        }
        // If query fails, try Prisma as fallback
        try {
          const parent = await this.prisma.wallCategory.findUnique({
            where: { id: parentCategoryId },
          });

          if (!parent) {
            throw new NotFoundException(`Parent category with ID ${parentCategoryId} not found`);
          }

          // Ensure parent is actually a parent (not a sub-category)
          const parentParentId = (parent as any).parentCategoryId;
          if (parentParentId !== null && parentParentId !== undefined && parentParentId !== '') {
            throw new BadRequestException('Cannot create sub-category under another sub-category. Maximum depth: category → sub-category');
          }
        } catch (prismaError: any) {
          if (prismaError instanceof NotFoundException || prismaError instanceof BadRequestException) {
            throw prismaError;
          }
          // If Prisma also fails, re-throw original error
          throw error;
        }
      }
    } else {
      // Explicitly set to null for parent categories
      parentCategoryId = null;
    }

    // Ensure schema has new fields before creating (avoid silently dropping parentCategoryId)
    const hasColumns = await this.prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'WallCategory' 
      AND column_name IN ('categoryFor', 'parentCategoryId', 'postCount', 'metadata')
      LIMIT 1
    ` as any[];

    if (!hasColumns || hasColumns.length === 0) {
      throw new BadRequestException(
        'WallCategory schema missing required columns. Please run migrations (npx prisma migrate deploy) before creating categories.'
      );
    }

    // Build create data, only including fields that exist
    const createData: any = {
      name: data.name,
      description: data.description,
      isActive: data.isActive !== undefined ? data.isActive : true,
    };

    // Try to create with new fields if they exist
    try {
      // Check if new columns exist
      const hasNewFields = await this.prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'WallCategory' 
        AND column_name IN ('categoryFor', 'parentCategoryId', 'postCount', 'metadata')
        LIMIT 1
      ` as any[];

      if (hasNewFields && hasNewFields.length > 0) {
        // New fields exist, create with them
        const category = await this.prisma.wallCategory.create({
          data: {
            ...createData,
            categoryFor: data.categoryFor,
            parentCategoryId: parentCategoryId,
            postCount: 0,
            metadata: {
              categoryFor: data.categoryFor,
              parentCategoryId: parentCategoryId,
            },
          },
        });

        // Calculate subCategoryCount if this is a parent category
        const isParent = !(category as any).parentCategoryId || (category as any).parentCategoryId === null;
        let subCategoryCount = 0;
        if (isParent) {
          try {
            subCategoryCount = await this.prisma.wallCategory.count({
              where: { 
                parentCategoryId: category.id,
                isActive: true,
              },
            });
          } catch {
            // If count fails, subCategoryCount remains 0
          }
        }

        return {
          id: category.id,
          name: category.name,
          description: category.description,
          categoryFor: (category as any).categoryFor ?? null,
          parentCategoryId: (category as any).parentCategoryId ?? null,
          isActive: category.isActive,
          postCount: (category as any).postCount ?? 0,
          subCategoryCount,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        };
      } else {
        // New fields don't exist, create without them
        const category = await this.prisma.wallCategory.create({
          data: createData,
        });

        return {
          id: category.id,
          name: category.name,
          description: category.description,
          categoryFor: null,
          parentCategoryId: null,
          isActive: category.isActive,
          postCount: 0,
          subCategoryCount: 0,
          metadata: {
            categoryFor: null,
            parentCategoryId: null,
          },
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        };
      }
    } catch (error: any) {
      // If creation fails, try without new fields
      if (error.message?.includes('does not exist') || error.message?.includes('column')) {
        const category = await this.prisma.wallCategory.create({
          data: createData,
        });

        return {
          id: category.id,
          name: category.name,
          description: category.description,
          categoryFor: null,
          parentCategoryId: null,
          isActive: category.isActive,
          postCount: 0,
          subCategoryCount: 0,
          metadata: {
            categoryFor: null,
            parentCategoryId: null,
          },
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        };
      }
      throw error;
    }
  }

  async updateWallCategory(id: string, data: any) {
    // Check if category exists
    const existing = await this.prisma.wallCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { subCategories: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    // Ensure schema has parentCategoryId column before allowing parent/child updates
    const hasParentColumn = await this.prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'WallCategory' 
      AND column_name = 'parentCategoryId'
      LIMIT 1
    ` as any[];

    if (!hasParentColumn || hasParentColumn.length === 0) {
      throw new BadRequestException(
        'WallCategory schema missing parentCategoryId. Please run migrations (npx prisma migrate deploy) before updating categories.'
      );
    }

    // Validate parentCategoryId if being changed
    let parentCategoryId: string | null = existing.parentCategoryId;
    
    if (data.parentCategoryId !== undefined) {
      // If setting to null, that's fine
      if (data.parentCategoryId === null || data.parentCategoryId === '') {
        parentCategoryId = null;
      } else {
        parentCategoryId = data.parentCategoryId;

        // Validate parent category exists
        const parent = await this.prisma.wallCategory.findUnique({
          where: { id: parentCategoryId },
        });

        if (!parent) {
          throw new NotFoundException(`Parent category with ID ${parentCategoryId} not found`);
        }

        // Prevent circular reference
        if (parentCategoryId === id) {
          throw new ConflictException('A category cannot be its own parent');
        }

        // Prevent setting a category as parent of its own parent (circular)
        if (parent.parentCategoryId === id) {
          throw new ConflictException('Circular reference detected: cannot set parent to a category that has this category as its parent');
        }

        // Prevent deep nesting
        if (parent.parentCategoryId !== null) {
          throw new BadRequestException('Cannot create more than 2 levels of nesting. Maximum depth: category → sub-category');
        }
      }

      // If category has sub-categories and we're trying to change parentCategoryId
      // We could either prevent it or allow it (cascade). For now, prevent it.
      if (existing._count.subCategories > 0 && parentCategoryId !== existing.parentCategoryId) {
        throw new ConflictException('Cannot change parentCategoryId for a category that has sub-categories. Delete sub-categories first or use cascade delete.');
      }
    }

    const updated = await this.prisma.wallCategory.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        categoryFor: data.categoryFor,
        parentCategoryId: parentCategoryId,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
        metadata: {
          categoryFor: data.categoryFor ?? existing.categoryFor,
          parentCategoryId: parentCategoryId,
        },
      },
      include: {
        _count: { select: { posts: true } },
      },
    });

    // Calculate subCategoryCount if this is a parent category
    const isParent = !updated.parentCategoryId || updated.parentCategoryId === null;
    let subCategoryCount = 0;
    if (isParent) {
      try {
        subCategoryCount = await this.prisma.wallCategory.count({
          where: { 
            parentCategoryId: updated.id,
            isActive: true,
          },
        });
      } catch {
        // If count fails, subCategoryCount remains 0
      }
    }

    // Return with parentCategoryId at root level (per requirements)
    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      categoryFor: updated.categoryFor ?? null,
      parentCategoryId: updated.parentCategoryId ?? null, // MUST be null, not undefined - Critical field
      isActive: updated.isActive,
      postCount: updated._count.posts,
      subCategoryCount, // For parent categories only
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteWallCategory(id: string) {
    const category = await this.prisma.wallCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            posts: true,
            subCategories: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Prevent deletion if category has posts (recommendation from requirements)
    if (category._count.posts > 0) {
      throw new ConflictException(`Cannot delete category: it is in use by ${category._count.posts} post(s). Set isActive to false instead.`);
    }

    // CASCADE delete sub-categories (as per requirements recommendation)
    // The Prisma schema has onDelete: Cascade, so this will happen automatically
    // But we should check if sub-categories have posts first
    if (category._count.subCategories > 0) {
      const subCategories = await this.prisma.wallCategory.findMany({
        where: { parentCategoryId: id },
        include: {
          _count: { select: { posts: true } },
        },
      });

      const subCategoriesWithPosts = subCategories.filter(sub => sub._count.posts > 0);
      if (subCategoriesWithPosts.length > 0) {
        throw new ConflictException(
          `Cannot delete category: it has ${subCategoriesWithPosts.length} sub-category/categories with posts. Delete or reassign posts first.`
        );
      }
    }

    // Delete the category (CASCADE will delete sub-categories automatically)
    await this.prisma.wallCategory.delete({ where: { id } });

    return {
      success: true,
      message: 'Category deleted successfully',
    };
  }

  // ========== Chapters ==========
  async getChapters(filters?: { subCategoryId?: string; isActive?: boolean }) {
    try {
      const where: any = {};
      
      if (filters?.subCategoryId) {
        where.subCategoryId = filters.subCategoryId;
      }
      
      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      const chapters = await this.prisma.chapter.findMany({
        where,
        include: {
          subCategory: {
            select: {
              id: true,
              name: true,
              parentCategoryId: true,
            },
          },
        },
        orderBy: [
          { order: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      return chapters.map((chapter) => ({
        id: chapter.id,
        name: chapter.name,
        description: chapter.description,
        subCategoryId: chapter.subCategoryId,
        subCategory: chapter.subCategory,
        isActive: chapter.isActive,
        order: chapter.order,
        metadata: chapter.metadata,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
      }));
    } catch (error: any) {
      console.error('Error fetching chapters:', error);
      throw new BadRequestException(`Failed to fetch chapters: ${error.message}`);
    }
  }

  async getChapterById(id: string) {
    try {
      const chapter = await this.prisma.chapter.findUnique({
        where: { id },
        include: {
          subCategory: {
            select: {
              id: true,
              name: true,
              parentCategoryId: true,
            },
          },
        },
      });

      if (!chapter) {
        throw new NotFoundException('Chapter not found');
      }

      return {
        id: chapter.id,
        name: chapter.name,
        description: chapter.description,
        subCategoryId: chapter.subCategoryId,
        subCategory: chapter.subCategory,
        isActive: chapter.isActive,
        order: chapter.order,
        metadata: chapter.metadata,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error fetching chapter:', error);
      throw new BadRequestException(`Failed to fetch chapter: ${error.message}`);
    }
  }

  async createChapter(data: any) {
    try {
      // Validate that subCategoryId exists and is a sub-category (has a parent)
      const subCategory = await this.prisma.wallCategory.findUnique({
        where: { id: data.subCategoryId },
        select: {
          id: true,
          name: true,
          parentCategoryId: true,
        },
      });

      if (!subCategory) {
        throw new NotFoundException('Sub-category not found');
      }

      // Ensure it's actually a sub-category (has a parent)
      if (!subCategory.parentCategoryId) {
        throw new BadRequestException('Chapters can only be created under sub-categories. The provided category is a parent category.');
      }

      // If order is not provided, set it to the next available order
      let order = data.order;
      if (order === undefined || order === null) {
        const maxOrder = await this.prisma.chapter.findFirst({
          where: { subCategoryId: data.subCategoryId },
          orderBy: { order: 'desc' },
          select: { order: true },
        });
        order = maxOrder ? maxOrder.order + 1 : 0;
      }

      const chapter = await this.prisma.chapter.create({
        data: {
          name: data.name,
          description: data.description,
          subCategoryId: data.subCategoryId,
          isActive: data.isActive !== undefined ? data.isActive : true,
          order: order,
          metadata: data.metadata,
        },
        include: {
          subCategory: {
            select: {
              id: true,
              name: true,
              parentCategoryId: true,
            },
          },
        },
      });

      return {
        id: chapter.id,
        name: chapter.name,
        description: chapter.description,
        subCategoryId: chapter.subCategoryId,
        subCategory: chapter.subCategory,
        isActive: chapter.isActive,
        order: chapter.order,
        metadata: chapter.metadata,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error creating chapter:', error);
      throw new BadRequestException(`Failed to create chapter: ${error.message}`);
    }
  }

  async updateChapter(id: string, data: any) {
    try {
      const existing = await this.prisma.chapter.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException('Chapter not found');
      }

      // If subCategoryId is being changed, validate the new sub-category
      if (data.subCategoryId && data.subCategoryId !== existing.subCategoryId) {
        const newSubCategory = await this.prisma.wallCategory.findUnique({
          where: { id: data.subCategoryId },
          select: {
            id: true,
            parentCategoryId: true,
          },
        });

        if (!newSubCategory) {
          throw new NotFoundException('Sub-category not found');
        }

        if (!newSubCategory.parentCategoryId) {
          throw new BadRequestException('Chapters can only be assigned to sub-categories. The provided category is a parent category.');
        }
      }

      const chapter = await this.prisma.chapter.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          subCategoryId: data.subCategoryId,
          isActive: data.isActive,
          order: data.order,
          metadata: data.metadata,
        },
        include: {
          subCategory: {
            select: {
              id: true,
              name: true,
              parentCategoryId: true,
            },
          },
        },
      });

      return {
        id: chapter.id,
        name: chapter.name,
        description: chapter.description,
        subCategoryId: chapter.subCategoryId,
        subCategory: chapter.subCategory,
        isActive: chapter.isActive,
        order: chapter.order,
        metadata: chapter.metadata,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error updating chapter:', error);
      throw new BadRequestException(`Failed to update chapter: ${error.message}`);
    }
  }

  async deleteChapter(id: string) {
    try {
      const chapter = await this.prisma.chapter.findUnique({
        where: { id },
      });

      if (!chapter) {
        throw new NotFoundException('Chapter not found');
      }

      await this.prisma.chapter.delete({ where: { id } });

      return {
        success: true,
        message: 'Chapter deleted successfully',
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error deleting chapter:', error);
      throw new BadRequestException(`Failed to delete chapter: ${error.message}`);
    }
  }
}
