import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CmsService {
  private readonly logger = new Logger(CmsService.name);

  constructor(private prisma: PrismaService) {}

  async getPages() {
    // Placeholder - implement when Pages model is added
    return [];
  }

  async getNews(filters?: any) {
    // Placeholder - implement when News model is added
    return [];
  }

  async getGallery(filters?: any) {
    // Placeholder - implement when Gallery model is added
    return [];
  }

  async getFaqs() {
    // Placeholder - implement when FAQ model is added
    return [];
  }

  // ========== Govt Vacancies ==========
  async getGovtVacancies(filters?: any) {
    const where: any = { 
      postType: 'GOVT_JOB',
      isActive: true,
    };
    
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    
    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    const page = parseInt(String(filters?.page || 1), 10);
    const limit = parseInt(String(filters?.limit || 20), 10);
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: { 
          user: {
            select: {
              id: true,
              email: true,
              profileImage: true,
            },
          },
          category: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    // Transform to match job format for mobile app compatibility
    const vacancies = posts.map((post) => {
      const metadata = post.metadata as any || {};
      return {
        id: post.id,
        postId: post.id,
        jobTitle: post.title,
        jobDescription: post.description,
        location: metadata.jobLocation || null,
        salaryMin: metadata.salaryMin || null,
        salaryMax: metadata.salaryMax || null,
        experience: metadata.experience || null,
        skills: metadata.skills || [],
        applicationDeadline: metadata.applicationSubmissionLastDate 
          ? new Date(metadata.applicationSubmissionLastDate) 
          : null,
        examDate: metadata.examDate ? new Date(metadata.examDate) : null,
        examName: metadata.examName || null,
        examFees: metadata.examFees || null,
        vacanciesSeat: metadata.vacanciesSeat || null,
        eligibility: metadata.eligibility || null,
        ageLimit: metadata.ageLimit || null,
        organisationImage: metadata.organisationImage || post.images?.[0] || null,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        post: {
          id: post.id,
          postType: post.postType,
          user: post.user,
        },
      };
    });

    return {
      data: vacancies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getGovtVacancyById(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { 
        id,
        postType: 'GOVT_JOB',
        isActive: true,
      },
      include: { 
        user: {
          select: {
            id: true,
            email: true,
            profileImage: true,
          },
        },
        category: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Government vacancy not found');
    }

    // Transform to match job format
    const metadata = post.metadata as any || {};
    return {
      id: post.id,
      postId: post.id,
      jobTitle: post.title,
      jobDescription: post.description,
      location: metadata.jobLocation || null,
      salaryMin: metadata.salaryMin || null,
      salaryMax: metadata.salaryMax || null,
      experience: metadata.experience || null,
      skills: metadata.skills || [],
      applicationDeadline: metadata.applicationSubmissionLastDate 
        ? new Date(metadata.applicationSubmissionLastDate) 
        : null,
      examDate: metadata.examDate ? new Date(metadata.examDate) : null,
      examName: metadata.examName || null,
      examFees: metadata.examFees || null,
      vacanciesSeat: metadata.vacanciesSeat || null,
      eligibility: metadata.eligibility || null,
      ageLimit: metadata.ageLimit || null,
      organisationImage: metadata.organisationImage || post.images?.[0] || null,
      nameOfPost: metadata.nameOfPost || post.title,
      firstAnnouncementDate: metadata.firstAnnouncementDate 
        ? new Date(metadata.firstAnnouncementDate) 
        : null,
      evaluationExamPattern: metadata.evaluationExamPattern || null,
      cutoff: metadata.cutoff || null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      post: {
        id: post.id,
        postType: post.postType,
        user: post.user,
      },
    };
  }

  // Lightweight list endpoint for Current Affairs (optimized for list views)
  async getCurrentAffairsList(filters?: any, userId?: string) {
    const where: any = { 
      postType: 'CURRENT_AFFAIRS',
      isActive: true,
    };
    
    // Filter last 24 hours if requested
    if (filters?.filterLast24Hours === 'true' || filters?.filterLast24Hours === true) {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      where.createdAt = { gte: yesterday };
    }
    
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = parseInt(String(filters?.page || 1), 10);
    const limit = parseInt(String(filters?.limit || 20), 10);
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          images: true,
          createdAt: true,
          updatedAt: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              profileImage: true,
            },
          },
          metadata: true,
          _count: {
            select: {
              likes: true,
              comments: true,
              bookmarks: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    // Filter by language if provided (check metadata) - case-insensitive
    let filteredPosts = posts;
    if (filters?.language) {
      const requestedLanguage = String(filters.language).toUpperCase();
      filteredPosts = posts.filter(post => {
        const metadata = (post.metadata as any) || {};
        const postLanguage = metadata.language ? String(metadata.language).toUpperCase() : null;
        return postLanguage === requestedLanguage || 
               (!postLanguage && requestedLanguage === 'ENGLISH');
      });
    }

    // Get read status for user if provided
    let readStatusMap: Record<string, { isRead: boolean; readAt: Date | null }> = {};
    if (userId && filteredPosts.length > 0) {
      const readRecords = await this.prisma.postRead.findMany({
        where: {
          userId,
          postId: { in: filteredPosts.map(p => p.id) },
        },
      });
      readStatusMap = readRecords.reduce((acc, record) => {
        acc[record.postId] = { isRead: true, readAt: record.readAt };
        return acc;
      }, {} as Record<string, { isRead: boolean; readAt: Date | null }>);
    }

    // Enhance posts with metadata, truncate description, and add read status
    const enhancedPosts = filteredPosts.map(post => {
      const metadata = (post.metadata as any) || {};
      const readStatus = readStatusMap[post.id] || { isRead: false, readAt: null };

      // Truncate description to 200 chars for list view
      const truncatedDescription = post.description 
        ? (post.description.length > 200 ? post.description.substring(0, 200) + '...' : post.description)
        : '';

      return {
        ...post,
        description: truncatedDescription,
        language: metadata.language || 'ENGLISH',
        metadata: {
          ...metadata,
          // Only include thumbnail, not full content
          thumbnail: metadata.thumbnail || metadata.image || post.images?.[0],
        },
        isRead: readStatus.isRead,
        readAt: readStatus.readAt,
      };
    });

    return {
      data: enhancedPosts,
      pagination: {
        page,
        limit,
        total: filteredPosts.length,
        totalPages: Math.ceil(filteredPosts.length / limit),
      },
    };
  }

  async getCurrentAffairs(filters?: any, userId?: string) {
    const where: any = { 
      postType: 'CURRENT_AFFAIRS',
      isActive: true,
    };
    
    // Filter last 24 hours if requested
    if (filters?.filterLast24Hours === 'true' || filters?.filterLast24Hours === true) {
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      where.createdAt = { gte: yesterday };
    }
    
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Note: Language filtering will be done in memory after fetching
    // because Prisma's JSON filtering is limited. We'll fetch more results
    // and filter by language case-insensitively.

    const page = parseInt(String(filters?.page || 1), 10);
    const limit = parseInt(String(filters?.limit || 20), 10);
    
    // If language filtering is active, fetch more results to account for filtering
    // This ensures we get enough results after language filtering
    const fetchLimit = filters?.language ? limit * 3 : limit;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          images: true,
          createdAt: true,
          updatedAt: true,
          postType: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              profileImage: true,
            },
          },
          metadata: true,
          _count: {
            select: {
              likes: true,
              comments: true,
              bookmarks: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: filters?.language ? 0 : skip, // Don't skip if filtering by language
        take: fetchLimit,
      }),
      this.prisma.post.count({ where }),
    ]);

    // Filter by language if provided (check metadata) - case-insensitive
    // Do this BEFORE getting read status so we only query for relevant posts
    let filteredPosts = posts;
    if (filters?.language) {
      const requestedLanguage = String(filters.language).toUpperCase();
      filteredPosts = posts.filter(post => {
        const metadata = (post.metadata as any) || {};
        const postLanguage = metadata.language ? String(metadata.language).toUpperCase() : null;
        // Match if language matches (case-insensitive) or if no language is set and requesting English
        return postLanguage === requestedLanguage || 
               (!postLanguage && requestedLanguage === 'ENGLISH');
      });
      
      // Apply pagination after language filtering
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      filteredPosts = filteredPosts.slice(startIndex, endIndex);
    }

    // Get read status for user if provided - use filtered posts
    let readStatusMap: Record<string, { isRead: boolean; readAt: Date | null }> = {};
    if (userId && filteredPosts.length > 0) {
      const readRecords = await this.prisma.postRead.findMany({
        where: {
          userId,
          postId: { in: filteredPosts.map(p => p.id) },
        },
      });
      readStatusMap = readRecords.reduce((acc, record) => {
        acc[record.postId] = { isRead: true, readAt: record.readAt };
        return acc;
      }, {} as Record<string, { isRead: boolean; readAt: Date | null }>);
    }

    // Add searchText and read status to each post
    const postsWithMetadata = filteredPosts.map(post => {
      const metadata = (post.metadata as any) || {};
      const searchText = [
        post.title,
        post.description,
        metadata.fullArticle || metadata.content || '',
        metadata.headline || '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/\s+/g, ' ')
        .trim();

      const readStatus = readStatusMap[post.id] || { isRead: false, readAt: null };

      return {
        ...post,
        // Add language field for easier access in frontend
        language: metadata.language || 'ENGLISH',
        searchText,
        isRead: readStatus.isRead,
        readAt: readStatus.readAt,
      };
    });

    // Recalculate pagination based on filtered results
    // If language filtering reduced results, we need to adjust pagination
    const filteredTotal = filteredPosts.length;
    
    // For accurate total count with language filtering, we'd need to count all matching posts
    // For now, use the filtered count as an approximation
    return {
      data: postsWithMetadata,
      pagination: {
        page,
        limit,
        total: filteredTotal, // Use filtered count
        totalPages: Math.ceil(filteredTotal / limit),
      },
    };
  }

  async getCurrentAffairById(id: string, userId?: string) {
    const post = await this.prisma.post.findFirst({
      where: { 
        id,
        postType: 'CURRENT_AFFAIRS',
        isActive: true 
      },
      include: { user: true, category: true },
    });

    if (!post) {
      throw new NotFoundException('Current affair not found');
    }

    // Get read status for user if provided
    let isRead = false;
    let readAt: Date | null = null;
    if (userId) {
      const readRecord = await this.prisma.postRead.findUnique({
        where: {
          userId_postId: {
            userId,
            postId: id,
          },
        },
      });
      if (readRecord) {
        isRead = true;
        readAt = readRecord.readAt;
      }
    }

    // Return post with metadata fields extracted
    const metadata = post.metadata as any || {};
    
    // Create searchText field
    const searchText = [
      post.title,
      post.description,
      metadata.fullArticle || metadata.content || '',
      metadata.headline || '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')
      .trim();
    
    return {
      ...post,
      // Extract full content from metadata - this is the full article text with HTML formatting
      content: metadata.fullArticle || metadata.content || post.description, // Use fullArticle (with HTML) if available, fallback to content, then description
      fullArticle: metadata.fullArticle || null, // Also return as fullArticle for clarity (preserves HTML formatting)
      quickViewContent: metadata.quickViewContent || null,
      isPublished: metadata.isPublished !== undefined ? metadata.isPublished : post.isActive,
      // Include other metadata fields that might be useful
      headline: metadata.headline || null,
      articleDate: metadata.articleDate || null,
      // Add searchText for enhanced search
      searchText,
      // Add read status
      isRead,
      readAt,
    };
  }

  // Lightweight list endpoint for General Knowledge (optimized for list views)
  async getGeneralKnowledgeList(filters?: any) {
    try {
      const where: any = { 
        postType: 'COLLEGE_FEED',
        isActive: true,
      };
      if (filters?.categoryId) where.categoryId = filters.categoryId;
      if (filters?.subCategoryId) {
        where.metadata = { path: ['subCategoryId'], equals: filters.subCategoryId };
      }
      if (filters?.chapterId) {
        where.metadata = { path: ['chapterId'], equals: filters.chapterId };
      }
      if (filters?.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const page = parseInt(String(filters?.page || 1), 10);
      const limit = parseInt(String(filters?.limit || 20), 10);
      const skip = (page - 1) * limit;

      const [posts, total] = await Promise.all([
        this.prisma.post.findMany({
          where,
          select: {
            id: true,
            title: true,
            description: true,
            images: true,
            createdAt: true,
            updatedAt: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            user: {
              select: {
                id: true,
                profileImage: true,
              },
            },
            metadata: true,
            _count: {
              select: {
                likes: true,
                comments: true,
                bookmarks: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.post.count({ where }),
      ]);

      // Batch fetch subcategories and chapters to avoid N+1
      const subCategoryIds = posts
        .map(p => (p.metadata as any)?.subCategoryId)
        .filter(Boolean);
      const chapterIds = posts
        .map(p => (p.metadata as any)?.chapterId)
        .filter(Boolean);

      const [subCategories, chapters] = await Promise.all([
        subCategoryIds.length > 0
          ? this.prisma.wallCategory.findMany({
              where: { id: { in: subCategoryIds } },
              select: { id: true, name: true },
            })
          : [],
        chapterIds.length > 0
          ? this.prisma.chapter.findMany({
              where: { id: { in: chapterIds } },
              select: { id: true, name: true },
            })
          : [],
      ]);

      const subCategoryMap = new Map<string, string>(subCategories.map(sc => [sc.id, sc.name] as [string, string]));
      const chapterMap = new Map<string, string>(chapters.map(ch => [ch.id, ch.name] as [string, string]));

      // Enhance posts with metadata and truncate description
      const enhancedPosts = posts.map(post => {
        const metadata = (post.metadata as any) || {};
        const subCategoryId = metadata.subCategoryId;
        const chapterId = metadata.chapterId;
        
        const subCategoryName = subCategoryMap.get(subCategoryId) || metadata.subCategory || '';
        const sectionName = chapterMap.get(chapterId) || metadata.section || metadata.sectionName || '';

        // Truncate description to 200 chars for list view
        const truncatedDescription = post.description 
          ? (post.description.length > 200 ? post.description.substring(0, 200) + '...' : post.description)
          : '';

        return {
          ...post,
          description: truncatedDescription,
          metadata: {
            ...metadata,
            subCategoryName,
            sectionName,
            // Only include thumbnail, not full content
            thumbnail: metadata.thumbnail || metadata.image || post.images?.[0],
          },
        };
      });

      return {
        data: enhancedPosts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      this.logger.error(`Error fetching general knowledge list: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to fetch general knowledge list: ${error.message}`);
    }
  }

  async getGeneralKnowledge(filters?: any) {
    try {
      const where: any = { 
        postType: 'COLLEGE_FEED',
        isActive: true,
        // Note: articleType filtering removed - all COLLEGE_FEED posts are returned
      };
      if (filters?.categoryId) where.categoryId = filters.categoryId;
      if (filters?.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const page = parseInt(String(filters?.page || 1), 10);
      const limit = parseInt(String(filters?.limit || 20), 10);
      const skip = (page - 1) * limit;

      const [posts, total] = await Promise.all([
        this.prisma.post.findMany({
          where,
          select: {
            id: true,
            title: true,
            description: true,
            images: true,
            createdAt: true,
            updatedAt: true,
            postType: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            user: {
              select: {
                id: true,
                profileImage: true,
              },
            },
            metadata: true,
            _count: {
              select: {
                likes: true,
                comments: true,
                bookmarks: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.post.count({ where }),
      ]);
      
      // Batch fetch subcategories and chapters to avoid N+1 queries
      const subCategoryIds = posts
        .map(p => (p.metadata as any)?.subCategoryId)
        .filter(Boolean);
      const chapterIds = posts
        .map(p => (p.metadata as any)?.chapterId)
        .filter(Boolean);

      const [subCategories, chapters] = await Promise.all([
        subCategoryIds.length > 0
          ? this.prisma.wallCategory.findMany({
              where: { id: { in: subCategoryIds } },
              select: { id: true, name: true },
            })
          : [],
        chapterIds.length > 0
          ? this.prisma.chapter.findMany({
              where: { id: { in: chapterIds } },
              select: { id: true, name: true },
            })
          : [],
      ]);

      // Create lookup maps for O(1) access
      const subCategoryMap = new Map<string, string>(subCategories.map(sc => [sc.id, sc.name] as [string, string]));
      const chapterMap = new Map<string, string>(chapters.map(ch => [ch.id, ch.name] as [string, string]));

      // Enhance posts using maps (O(1) lookup instead of N queries)
      const enhancedPosts = posts.map(post => {
        const metadata = (post.metadata as any) || {};
        const subCategoryId = metadata.subCategoryId;
        const chapterId = metadata.chapterId;
        
        const subCategoryName = subCategoryMap.get(subCategoryId) || metadata.subCategory || '';
        const sectionName = chapterMap.get(chapterId) || metadata.section || metadata.sectionName || '';
        
        // Update metadata with names
        const updatedMetadata = {
          ...metadata,
          ...(subCategoryName && { subCategory: subCategoryName, subCategoryName }),
          ...(sectionName && { section: sectionName, sectionName }),
        };
        
        return {
          ...post,
          metadata: updatedMetadata,
          subCategory: subCategoryName ? { name: subCategoryName } : null,
        };
      });

      // Filter by language if provided (check metadata)
      let filteredPosts = enhancedPosts;
      if (filters?.language) {
        filteredPosts = enhancedPosts.filter(post => {
          const metadata = (post.metadata as any) || {};
          return metadata.language === filters.language;
        });
      }

      // Add searchText to each post for enhanced search
      const postsWithSearchText = filteredPosts.map(post => {
        const metadata = (post.metadata as any) || {};
        const searchText = [
          post.title,
          post.description,
          metadata.fullArticle || metadata.content || '',
          metadata.headline || '',
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/\s+/g, ' ')
          .trim();

        return {
          ...post,
          searchText,
        };
      });

      // Note: Total count doesn't account for language filtering for simplicity
      // The actual returned data is filtered correctly
      return {
        data: postsWithSearchText,
        pagination: {
          page,
          limit,
          total: filteredPosts.length, // Use filtered count
          totalPages: Math.ceil(filteredPosts.length / limit),
        },
      };
    } catch (error: any) {
      this.logger.error(`Error fetching general knowledge articles: ${error.message}`, error.stack);
      // Re-throw with more context if it's a known error type
      if (error.code === 'P1001' || error.message?.includes('connect') || error.message?.includes('DATABASE_URL')) {
        throw new BadRequestException('Database connection error. Please check DATABASE_URL environment variable.');
      }
      throw new BadRequestException(`Failed to fetch general knowledge articles: ${error.message}`);
    }
  }

  async getGeneralKnowledgeById(id: string) {
    const post = await this.prisma.post.findFirst({
      where: { 
        id,
        postType: 'COLLEGE_FEED',
        isActive: true,
        // Note: articleType filtering removed
      },
      include: { user: true, category: true },
    });

    if (!post) {
      throw new NotFoundException('General knowledge article not found');
    }

    // Return post with metadata fields extracted
    const metadata = post.metadata as any || {};
    
    // Create searchText field by combining title, description, and metadata content
    const searchText = [
      post.title,
      post.description,
      metadata.fullArticle || metadata.content || '',
      metadata.headline || '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')
      .trim();
    
    return {
      ...post,
      // Extract full content from metadata - this is the full article text with HTML formatting
      content: metadata.fullArticle || metadata.content || post.description, // Use fullArticle (with HTML) if available, fallback to content, then description
      fullArticle: metadata.fullArticle || null, // Also return as fullArticle for clarity (preserves HTML formatting)
      quickViewContent: metadata.quickViewContent || null,
      isPublished: metadata.isPublished !== undefined ? metadata.isPublished : post.isActive,
      // Include other metadata fields that might be useful
      headline: metadata.headline || null,
      articleDate: metadata.articleDate || null,
      // Add searchText for enhanced search
      searchText,
    };
  }

  async getCurrentAffairsDailyDigest(language?: string, userId?: string) {
    // Get last 24 hours current affairs
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const where: any = {
      postType: 'CURRENT_AFFAIRS',
      isActive: true,
      createdAt: {
        gte: yesterday,
      },
    };

    const posts = await this.prisma.post.findMany({
      where,
      include: { user: true, category: true },
      orderBy: { createdAt: 'desc' },
      take: 50, // Get more to allow filtering
    });

    // Filter by metadata.isPublished if available
    let publishedPosts = posts.filter(post => {
      const metadata = post.metadata as any || {};
      return metadata.isPublished !== false; // Include if not explicitly false
    });

    // Filter by language if provided - case-insensitive
    if (language) {
      const requestedLanguage = String(language).toUpperCase();
      publishedPosts = publishedPosts.filter(post => {
        const metadata = post.metadata as any || {};
        const postLanguage = metadata.language ? String(metadata.language).toUpperCase() : null;
        // Match if language matches (case-insensitive) or if no language is set and requesting English
        return postLanguage === requestedLanguage || 
               (!postLanguage && requestedLanguage === 'ENGLISH');
      });
    }

    // Get read status for user if provided
    let readStatusMap: Record<string, boolean> = {};
    if (userId && publishedPosts.length > 0) {
      const readRecords = await this.prisma.postRead.findMany({
        where: {
          userId,
          postId: { in: publishedPosts.map(p => p.id) },
        },
      });
      readStatusMap = readRecords.reduce((acc, record) => {
        acc[record.postId] = true;
        return acc;
      }, {} as Record<string, boolean>);
    }

    // Add completion status to each post
    const postsWithCompletion = publishedPosts.slice(0, 20).map(post => ({
      ...post,
      isRead: readStatusMap[post.id] || false,
    }));

    return {
      data: postsWithCompletion,
      count: publishedPosts.length,
    };
  }

  async getGeneralKnowledgeDailyDigest(excludePublished: boolean = true, language?: string, userId?: string) {
    try {
      // Get posts that haven't been shown in daily digest in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      let excludedPostIds: string[] = [];
      if (excludePublished) {
        const shownPosts = await this.prisma.dailyDigestGkArticle.findMany({
          where: {
            shownAt: { gte: sevenDaysAgo },
          },
          select: { postId: true },
        });
        excludedPostIds = shownPosts.map(sp => sp.postId);
      }

      // Build where clause
      const where: any = {
        postType: 'COLLEGE_FEED',
        isActive: true,
        ...(excludedPostIds.length > 0 && {
          id: { notIn: excludedPostIds },
        }),
      };

      // Get 20 random general knowledge articles (excluding already shown ones)
      const posts = await this.prisma.post.findMany({
        where,
        include: { user: true, category: true },
        take: excludedPostIds.length > 0 ? 100 : 20, // Get more for randomization if we have exclusions
      });

      // Filter by language if provided
      let filteredPosts = posts;
      if (language) {
        filteredPosts = posts.filter(post => {
          const metadata = (post.metadata as any) || {};
          return metadata.language === language;
        });
      }

      // Shuffle and take 20 random
      const shuffled = filteredPosts.sort(() => 0.5 - Math.random());
      const randomPosts = shuffled.slice(0, 20);

      // Get read status for user if provided
      let readStatusMap: Record<string, boolean> = {};
      if (userId && randomPosts.length > 0) {
        const readRecords = await this.prisma.postRead.findMany({
          where: {
            userId,
            postId: { in: randomPosts.map(p => p.id) },
          },
        });
        readStatusMap = readRecords.reduce((acc, record) => {
          acc[record.postId] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }

      // Track the articles shown in daily digest
      if (randomPosts.length > 0) {
        try {
          await this.prisma.dailyDigestGkArticle.createMany({
            data: randomPosts.map(post => ({
              postId: post.id,
              shownAt: new Date(),
            })),
            skipDuplicates: true,
          });
        } catch (trackError: any) {
          // Log but don't fail if tracking fails
          this.logger.warn(`⚠️ Failed to track shown GK articles: ${trackError.message}`);
        }
      }

      // Add completion status to each post
      const postsWithCompletion = randomPosts.map(post => ({
        ...post,
        isRead: readStatusMap[post.id] || false,
      }));

      this.logger.log(`✅ Returning ${postsWithCompletion.length} GK articles for daily digest`);
      return {
        data: postsWithCompletion,
        count: postsWithCompletion.length,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error getting general knowledge daily digest: ${error.message}`, error.stack);
      // Return empty array on error
      return {
        data: [],
        count: 0,
      };
    }
  }

  async getCategories() {
    try {
      // Get all parent categories (where parentCategoryId is null) for general knowledge
      const categories = await this.prisma.wallCategory.findMany({
        where: {
          parentCategoryId: null,
          isActive: true,
          // Optionally filter by categoryFor if needed
          // categoryFor: 'GENERAL_KNOWLEDGE', // Uncomment if you want to filter by categoryFor
        },
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              posts: {
                where: {
                  postType: 'COLLEGE_FEED',
                  isActive: true,
                },
              },
            },
          },
        },
      });

      // Map to include postCount
      const categoriesWithCounts = categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        isActive: cat.isActive,
        postCount: cat._count.posts,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      }));

      return {
        data: categoriesWithCounts,
        count: categoriesWithCounts.length,
      };
    } catch (error: any) {
      this.logger.error(`Error getting general knowledge categories: ${error.message}`, error.stack);
      if (error.code === 'P1001' || error.message?.includes('connect') || error.message?.includes('DATABASE_URL')) {
        throw new BadRequestException('Database connection error. Please check DATABASE_URL environment variable.');
      }
      throw new BadRequestException(`Failed to get categories: ${error.message}`);
    }
  }

  async getCurrentAffairsCategories() {
    try {
      // Get all parent categories (where parentCategoryId is null) for current affairs
      const categories = await this.prisma.wallCategory.findMany({
        where: {
          parentCategoryId: null,
          isActive: true,
        },
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              posts: {
                where: {
                  postType: 'CURRENT_AFFAIRS',
                  isActive: true,
                },
              },
            },
          },
        },
      });

      // Map to include postCount
      const categoriesWithCounts = categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        isActive: cat.isActive,
        postCount: cat._count.posts,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      }));

      return {
        data: categoriesWithCounts,
        count: categoriesWithCounts.length,
      };
    } catch (error: any) {
      this.logger.error(`Error getting current affairs categories: ${error.message}`, error.stack);
      if (error.code === 'P1001' || error.message?.includes('connect') || error.message?.includes('DATABASE_URL')) {
        throw new BadRequestException('Database connection error. Please check DATABASE_URL environment variable.');
      }
      throw new BadRequestException(`Failed to get current affairs categories: ${error.message}`);
    }
  }

  async getSubcategories(categoryId: string) {
    try {
      // Verify category exists and is a top-level category (parentCategoryId should be null)
      const category = await this.prisma.wallCategory.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        throw new NotFoundException(`Category with ID ${categoryId} not found`);
      }

      // Verify it's a top-level category (optional validation - can be removed if you want to allow nested subcategories)
      if (category.parentCategoryId !== null) {
        this.logger.warn(`Category ${categoryId} is not a top-level category (has parent: ${category.parentCategoryId})`);
        // Still allow it, but log a warning
      }

      // Get subcategories (categories where parentCategoryId = categoryId)
      // This ensures only subcategories of the specified category are returned
      const subcategories = await this.prisma.wallCategory.findMany({
        where: {
          parentCategoryId: categoryId, // Only subcategories that belong to this specific category
          isActive: true,
        },
        orderBy: { name: 'asc' },
      });

      this.logger.log(`Found ${subcategories.length} subcategories for category ${categoryId} (${category.name})`);

      return {
        data: subcategories,
        count: subcategories.length,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error getting subcategories for category ${categoryId}: ${error.message}`, error.stack);
      if (error.code === 'P1001' || error.message?.includes('connect') || error.message?.includes('DATABASE_URL')) {
        throw new BadRequestException('Database connection error. Please check DATABASE_URL environment variable.');
      }
      throw new BadRequestException(`Failed to get subcategories: ${error.message}`);
    }
  }

  async getSections(subCategoryId: string) {
    try {
      // Verify subcategory exists
      const subCategory = await this.prisma.wallCategory.findUnique({
        where: { id: subCategoryId },
      });

      if (!subCategory) {
        throw new NotFoundException(`Subcategory with ID ${subCategoryId} not found`);
      }

      // Verify it's actually a subcategory (has a parentCategoryId)
      if (subCategory.parentCategoryId === null) {
        this.logger.warn(`Category ${subCategoryId} is a top-level category, not a subcategory`);
        // Still allow it, but log a warning
      }

      // Get chapters for this specific subcategory only
      // This ensures only chapters that belong to the selected subcategory are returned
      const chapters = await this.prisma.chapter.findMany({
        where: {
          subCategoryId: subCategoryId, // Only chapters that belong to this specific subcategory
          isActive: true,
        },
        orderBy: [
          { order: 'asc' },
          { name: 'asc' },
        ],
      });

      this.logger.log(`Found ${chapters.length} chapters for subcategory ${subCategoryId} (${subCategory.name})`);

      return {
        data: chapters,
        count: chapters.length,
      };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error getting chapters for subcategory ${subCategoryId}: ${error.message}`, error.stack);
      if (error.code === 'P1001' || error.message?.includes('connect') || error.message?.includes('DATABASE_URL')) {
        throw new BadRequestException('Database connection error. Please check DATABASE_URL environment variable.');
      }
      throw new BadRequestException(`Failed to get chapters: ${error.message}`);
    }
  }

  async bookmarkArticle(userId: string, articleId: string) {
    try {
      // Verify article exists - General Knowledge articles use COLLEGE_FEED postType
      // We check by ID first, then verify it's a COLLEGE_FEED type
      const article = await this.prisma.post.findFirst({
        where: {
          id: articleId,
          postType: 'COLLEGE_FEED',
          isActive: true,
        },
      });

      if (!article) {
        // Try to find the article without postType restriction to give better error message
        const anyArticle = await this.prisma.post.findFirst({
          where: { id: articleId },
        });
        if (!anyArticle) {
          throw new NotFoundException('Article not found');
        }
        if (anyArticle.postType !== 'COLLEGE_FEED') {
          throw new NotFoundException('This endpoint is for General Knowledge articles only');
        }
        throw new NotFoundException('General knowledge article not found or inactive');
      }

      // Check if bookmark already exists
      const existingBookmark = await this.prisma.postBookmark.findUnique({
        where: {
          userId_postId: {
            userId,
            postId: articleId,
          },
        },
      });

      if (existingBookmark) {
        // Remove bookmark
        await this.prisma.postBookmark.delete({
          where: { id: existingBookmark.id },
        });
        this.logger.log(`Bookmark removed for article ${articleId} by user ${userId}`);
        return { bookmarked: false, message: 'Article unbookmarked successfully' };
      }

      // Create bookmark
      try {
        await this.prisma.postBookmark.create({
          data: {
            userId,
            postId: articleId,
          },
        });

        this.logger.log(`Article ${articleId} bookmarked by user ${userId}`);
        return { bookmarked: true, message: 'Article bookmarked successfully' };
      } catch (createError: any) {
        // Handle unique constraint error (P2002) - item already bookmarked
        if (createError.code === 'P2002') {
          // Item is already bookmarked, return success response
          this.logger.log(`Article ${articleId} already bookmarked by user ${userId}`);
          return { bookmarked: true, message: 'Already bookmarked', alreadyBookmarked: true };
        }
        throw createError;
      }
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      // If it's a unique constraint error, treat as already bookmarked
      if (error.code === 'P2002') {
        this.logger.log(`Article ${articleId} already bookmarked by user ${userId} (unique constraint)`);
        return { bookmarked: true, message: 'Already bookmarked', alreadyBookmarked: true };
      }
      this.logger.error(`Error bookmarking article ${articleId} for user ${userId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to bookmark article: ${error.message}`);
    }
  }

  async reportArticle(userId: string, articleId: string, reason?: string, description?: string) {
    try {
      // Verify article exists
      const article = await this.prisma.post.findFirst({
        where: {
          id: articleId,
          postType: 'COLLEGE_FEED',
          isActive: true,
        },
      });

      if (!article) {
        throw new NotFoundException('General knowledge article not found');
      }

      // Check if user has already reported this article
      const existingReport = await this.prisma.postReport.findUnique({
        where: {
          userId_postId: {
            userId,
            postId: articleId,
          },
        },
      });

      if (existingReport) {
        // Update existing report
        await this.prisma.postReport.update({
          where: { id: existingReport.id },
          data: {
            reason: reason || existingReport.reason,
            description: description || existingReport.description,
            status: 'pending', // Reset to pending if updating
            updatedAt: new Date(),
          },
        });
        this.logger.log(`Report updated for article ${articleId} by user ${userId}`);
        return { success: true, message: 'Report updated successfully' };
      }

      // Create new report
      await this.prisma.postReport.create({
        data: {
          userId,
          postId: articleId,
          reason: reason || null,
          description: description || null,
          status: 'pending',
        },
      });

      this.logger.log(`Article ${articleId} reported by user ${userId}`);
      return { success: true, message: 'Article reported successfully' };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error reporting article ${articleId} for user ${userId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to report article: ${error.message}`);
    }
  }

  async bookmarkCurrentAffair(userId: string, articleId: string) {
    try {
      // Verify article exists
      const article = await this.prisma.post.findFirst({
        where: {
          id: articleId,
          postType: 'CURRENT_AFFAIRS',
          isActive: true,
        },
      });

      if (!article) {
        throw new NotFoundException('Current affair article not found');
      }

      // Check if bookmark already exists
      const existingBookmark = await this.prisma.postBookmark.findUnique({
        where: {
          userId_postId: {
            userId,
            postId: articleId,
          },
        },
      });

      if (existingBookmark) {
        // Remove bookmark
        await this.prisma.postBookmark.delete({
          where: { id: existingBookmark.id },
        });
        this.logger.log(`Bookmark removed for current affair ${articleId} by user ${userId}`);
        return { bookmarked: false, message: 'Article unbookmarked successfully' };
      }

      // Create bookmark
      try {
        await this.prisma.postBookmark.create({
          data: {
            userId,
            postId: articleId,
          },
        });

        this.logger.log(`Current affair ${articleId} bookmarked by user ${userId}`);
        return { bookmarked: true, message: 'Article bookmarked successfully' };
      } catch (createError: any) {
        // Handle unique constraint error (P2002) - item already bookmarked
        if (createError.code === 'P2002') {
          // Item is already bookmarked, return success response
          this.logger.log(`Current affair ${articleId} already bookmarked by user ${userId}`);
          return { bookmarked: true, message: 'Already bookmarked', alreadyBookmarked: true };
        }
        throw createError;
      }
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      // If it's a unique constraint error, treat as already bookmarked
      if (error.code === 'P2002') {
        this.logger.log(`Current affair ${articleId} already bookmarked by user ${userId} (unique constraint)`);
        return { bookmarked: true, message: 'Already bookmarked', alreadyBookmarked: true };
      }
      this.logger.error(`Error bookmarking current affair ${articleId} for user ${userId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to bookmark article: ${error.message}`);
    }
  }

  async reportCurrentAffair(userId: string, articleId: string, reason?: string, description?: string) {
    try {
      // Verify article exists
      const article = await this.prisma.post.findFirst({
        where: {
          id: articleId,
          postType: 'CURRENT_AFFAIRS',
          isActive: true,
        },
      });

      if (!article) {
        throw new NotFoundException('Current affair article not found');
      }

      // Check if user has already reported this article
      const existingReport = await this.prisma.postReport.findUnique({
        where: {
          userId_postId: {
            userId,
            postId: articleId,
          },
        },
      });

      if (existingReport) {
        // Update existing report
        await this.prisma.postReport.update({
          where: { id: existingReport.id },
          data: {
            reason: reason || existingReport.reason,
            description: description || existingReport.description,
            status: 'pending', // Reset to pending if updating
            updatedAt: new Date(),
          },
        });
        this.logger.log(`Report updated for current affair ${articleId} by user ${userId}`);
        return { success: true, message: 'Report updated successfully' };
      }

      // Create new report
      await this.prisma.postReport.create({
        data: {
          userId,
          postId: articleId,
          reason: reason || null,
          description: description || null,
          status: 'pending',
        },
      });

      this.logger.log(`Current affair ${articleId} reported by user ${userId}`);
      return { success: true, message: 'Article reported successfully' };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error reporting current affair ${articleId} for user ${userId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to report article: ${error.message}`);
    }
  }

  async trackView(articleId: string, userId?: string, postType: 'CURRENT_AFFAIRS' | 'COLLEGE_FEED' = 'CURRENT_AFFAIRS') {
    try {
      // Verify article exists
      const article = await this.prisma.post.findFirst({
        where: {
          id: articleId,
          postType,
          isActive: true,
        },
      });

      if (!article) {
        const articleType = postType === 'CURRENT_AFFAIRS' ? 'Current affair' : 'General knowledge article';
        throw new NotFoundException(`${articleType} not found`);
      }

      // Create view record
      await this.prisma.postView.create({
        data: {
          postId: articleId,
          userId: userId || null,
        },
      });

      const articleType = postType === 'CURRENT_AFFAIRS' ? 'current affair' : 'general knowledge article';
      this.logger.log(`View tracked for ${articleType} ${articleId} by user ${userId || 'anonymous'}`);
      return { success: true, message: 'View tracked successfully' };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error tracking view for article ${articleId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to track view: ${error.message}`);
    }
  }

  async trackViewDuration(articleId: string, duration: number, userId?: string, postType: 'CURRENT_AFFAIRS' | 'COLLEGE_FEED' = 'CURRENT_AFFAIRS') {
    try {
      // Verify article exists
      const article = await this.prisma.post.findFirst({
        where: {
          id: articleId,
          postType,
          isActive: true,
        },
      });

      if (!article) {
        const articleType = postType === 'CURRENT_AFFAIRS' ? 'Current affair article' : 'General knowledge article';
        throw new NotFoundException(`${articleType} not found`);
      }

      // Validate duration (should be positive)
      if (duration < 0) {
        throw new BadRequestException('Duration must be a positive number');
      }

      // Create view duration record
      await this.prisma.postViewDuration.create({
        data: {
          postId: articleId,
          userId: userId || null,
          duration,
        },
      });

      // If user is authenticated and duration >= 20 seconds, mark as read
      if (userId && duration >= 20) {
        // Check if already read
        const existingRead = await this.prisma.postRead.findUnique({
          where: {
            userId_postId: {
              userId,
              postId: articleId,
            },
          },
        });

        if (!existingRead) {
          await this.prisma.postRead.create({
            data: {
              userId,
              postId: articleId,
            },
          });
          this.logger.log(`Article ${articleId} marked as read by user ${userId} (duration: ${duration}s)`);
        }
      }

      const articleType = postType === 'CURRENT_AFFAIRS' ? 'current affair' : 'general knowledge article';
      this.logger.log(`View duration tracked for ${articleType} ${articleId}: ${duration}s by user ${userId || 'anonymous'}`);
      return { success: true, message: 'View duration tracked successfully' };
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error tracking view duration for article ${articleId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to track view duration: ${error.message}`);
    }
  }

  async getBookmarkedArticles(userId: string, filters?: {
    type?: 'GENERAL_KNOWLEDGE' | 'CURRENT_AFFAIRS' | 'ALL';
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const page = parseInt(String(filters?.page || 1), 10);
      const limit = parseInt(String(filters?.limit || 20), 10);
      const skip = (page - 1) * limit;

      // Get all bookmarked post IDs for this user
      const bookmarks = await this.prisma.postBookmark.findMany({
        where: { userId },
        select: { postId: true },
      });

      const bookmarkedPostIds = bookmarks.map(b => b.postId);

      if (bookmarkedPostIds.length === 0) {
        return {
          data: [],
          count: 0,
        };
      }

      // Build where clause
      const where: any = {
        id: { in: bookmarkedPostIds },
        isActive: true,
      };

      // Filter by type
      const postType = filters?.type || 'ALL';
      if (postType === 'GENERAL_KNOWLEDGE') {
        where.postType = 'COLLEGE_FEED'; // General Knowledge uses COLLEGE_FEED type
      } else if (postType === 'CURRENT_AFFAIRS') {
        where.postType = 'CURRENT_AFFAIRS';
      } else {
        // ALL - include both types
        where.postType = { in: ['COLLEGE_FEED', 'CURRENT_AFFAIRS'] };
      }

      if (filters?.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      if (filters?.category) {
        where.categoryId = filters.category;
      }

      const [posts, total] = await Promise.all([
        this.prisma.post.findMany({
          where,
          include: { user: true, category: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.post.count({ where }),
      ]);

      // Add searchText and isBookmarked flag
      const postsWithMetadata = posts.map(post => {
        const metadata = (post.metadata as any) || {};
        const searchText = [
          post.title,
          post.description,
          metadata.fullArticle || metadata.content || '',
          metadata.headline || '',
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        return {
          ...post,
          searchText,
          isBookmarked: true, // All posts in this list are bookmarked
        };
      });

      return {
        data: postsWithMetadata,
        count: total,
      };
    } catch (error: any) {
      this.logger.error(`Error getting bookmarked articles for user ${userId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to get bookmarked articles: ${error.message}`);
    }
  }

  async getBookmarkedGeneralKnowledge(userId: string, filters?: {
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) {
    return this.getBookmarkedArticles(userId, { ...filters, type: 'GENERAL_KNOWLEDGE' });
  }

  async getBookmarkedCurrentAffairs(userId: string, filters?: {
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) {
    return this.getBookmarkedArticles(userId, { ...filters, type: 'CURRENT_AFFAIRS' });
  }
}

