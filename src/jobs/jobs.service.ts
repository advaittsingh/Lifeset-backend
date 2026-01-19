import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class JobsService {
  constructor(
    private prisma: PrismaService,
    private analytics: AnalyticsService,
  ) {}

  async createJobPost(companyId: string, postId: string, data: {
    jobTitle: string;
    jobDescription: string;
    location?: string;
    salaryMin?: number;
    salaryMax?: number;
    experience?: string;
    skills?: string[];
    applicationDeadline?: Date;
  }) {
    return this.prisma.jobPost.create({
      data: {
        postId,
        jobTitle: data.jobTitle,
        jobDescription: data.jobDescription,
        location: data.location,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        experience: data.experience,
        skills: data.skills || [],
        applicationDeadline: data.applicationDeadline,
      },
    });
  }

  // Lightweight list endpoint for Jobs (optimized for list views)
  async getJobsList(filters: {
    search?: string;
    location?: string;
    skills?: string[];
    page?: number;
    limit?: number;
    type?: 'JOB' | 'INTERNSHIP' | 'FREELANCING' | 'GOVT_JOB' | string;
    excludeType?: 'JOB' | 'INTERNSHIP' | 'FREELANCING' | 'GOVT_JOB' | string;
  }) {
    const page = parseInt(String(filters.page || 1), 10);
    const limit = parseInt(String(filters.limit || 20), 10);
    const skip = (page - 1) * limit;

    // Normalize type filter to match FeedType enum
    const normalizePostType = (type: string | undefined): 'JOB' | 'INTERNSHIP' | 'FREELANCING' | 'GOVT_JOB' | undefined => {
      if (!type) return undefined;
      const normalized = type.toUpperCase();
      if (normalized === 'FREELANCE' || normalized === 'FREELANCING') return 'FREELANCING';
      if (normalized === 'INTERNSHIP') return 'INTERNSHIP';
      if (normalized === 'JOB') return 'JOB';
      if (normalized === 'GOVT_JOB' || normalized === 'GOVT-JOB' || normalized === 'GOVTJOB') return 'GOVT_JOB';
      // If already a valid enum value, return as-is
      if (['JOB', 'INTERNSHIP', 'FREELANCING', 'GOVT_JOB'].includes(normalized)) {
        return normalized as 'JOB' | 'INTERNSHIP' | 'FREELANCING' | 'GOVT_JOB';
      }
      return undefined;
    };

    const postFilter: any = { 
      isActive: true,
      postType: { in: ['JOB', 'INTERNSHIP', 'FREELANCING', 'GOVT_JOB'] },
    };
    
    if (filters.excludeType) {
      const normalizedExclude = normalizePostType(filters.excludeType);
      if (normalizedExclude) {
        postFilter.postType = { 
          in: ['JOB', 'INTERNSHIP', 'FREELANCING', 'GOVT_JOB'].filter(t => t !== normalizedExclude)
        };
      }
    } else if (filters.type) {
      const normalizedType = normalizePostType(filters.type);
      if (normalizedType) {
        postFilter.postType = normalizedType;
      }
    }

    if (filters.search) {
      postFilter.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: postFilter,
        select: {
          id: true,
          title: true,
          description: true,
          postType: true,
          images: true,
          createdAt: true,
          updatedAt: true,
          metadata: true,
          user: {
            select: {
              id: true,
              profileImage: true,
              companyProfile: {
                select: {
                  id: true,
                  companyName: true,
                  industry: true,
                },
              },
            },
          },
          jobPost: {
            select: {
              id: true,
              location: true,
              salaryMin: true,
              salaryMax: true,
              experience: true,
              skills: true,
              views: true,
              applications: true,
            },
          },
          _count: {
            select: {
              applications: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.post.count({ where: postFilter }),
    ]);

    // Transform and truncate for list view
    const jobs = posts.map((post) => {
      const jobPost = post.jobPost;
      const metadata = post.metadata as any || {};
      
      // Truncate description to 200 chars
      const truncatedDescription = post.description && post.description.length > 200
        ? post.description.substring(0, 200) + '...'
        : post.description;

      // Extract company name from multiple locations (improved extraction)
      const companyName = 
        metadata.companyName || 
        (post as any).companyName || 
        post.user?.companyProfile?.companyName || 
        null;
      
      // Extract job function from metadata or post columns
      const jobFunction = 
        metadata.jobFunction || 
        (post as any).jobFunction || 
        null;
      
      // Extract industry from multiple locations
      const industry = 
        metadata.industry || 
        (post as any).industry || 
        post.user?.companyProfile?.industry || 
        null;
      
      // Extract work time from metadata or post columns
      const workTime = 
        metadata.workTime || 
        (post as any).workTime || 
        null;
      
      // Map postType to jobType for frontend compatibility
      // Priority: metadata.jobType > postType mapping
      let jobType: string | null = null;
      
      // First, check metadata for explicit jobType
      if (metadata.jobType || metadata.job_type || metadata.type) {
        jobType = metadata.jobType || metadata.job_type || metadata.type;
        // Normalize to lowercase for consistency
        if (jobType) {
          jobType = jobType.toLowerCase();
          // Map 'contract' variations to 'contract'
          if (jobType === 'contract' || jobType === 'contracting') {
            jobType = 'contract';
          } else if (jobType === 'freelance' || jobType === 'freelancing') {
            jobType = 'freelance';
          } else if (jobType === 'internship' || jobType === 'intern') {
            jobType = 'internship';
          }
        }
      } else {
        // Fallback to postType mapping if no metadata jobType
        if (post.postType === 'INTERNSHIP') {
          jobType = 'internship';
        } else if (post.postType === 'FREELANCING') {
          jobType = 'freelance'; // Default for freelancing
        }
        // For JOB and GOVT_JOB postType, jobType remains null (regular jobs)
      }

      return {
        id: jobPost?.id || post.id,
        postId: post.id,
        jobTitle: post.title,
        jobDescription: truncatedDescription,
        companyName, // Added company name
        jobFunction, // Added job function
        industry, // Added industry
        workTime, // Added work time
        location: jobPost?.location || metadata.jobLocation || null,
        salaryMin: jobPost?.salaryMin || metadata.salaryMin || null,
        salaryMax: jobPost?.salaryMax || metadata.salaryMax || null,
        experience: jobPost?.experience || metadata.experience || null,
        skills: jobPost?.skills || metadata.skills || [],
        views: jobPost?.views || 0,
        applications: jobPost?.applications || post._count.applications || 0,
        createdAt: post.createdAt,
        postType: post.postType,
        jobType: jobType, // Added jobType field for frontend filtering
        user: post.user,
      };
    });

    return {
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getJobs(filters: {
    search?: string;
    location?: string;
    skills?: string[];
    page?: number;
    limit?: number;
    type?: 'JOB' | 'INTERNSHIP' | 'FREELANCING' | 'GOVT_JOB' | string;
    excludeType?: 'JOB' | 'INTERNSHIP' | 'FREELANCING' | 'GOVT_JOB' | string;
  }) {
    const page = parseInt(String(filters.page || 1), 10);
    const limit = parseInt(String(filters.limit || 20), 10);
    const skip = (page - 1) * limit;

    // Normalize type filter to match FeedType enum
    const normalizePostType = (type: string | undefined): 'JOB' | 'INTERNSHIP' | 'FREELANCING' | 'GOVT_JOB' | undefined => {
      if (!type) return undefined;
      const normalized = type.toUpperCase();
      if (normalized === 'FREELANCE' || normalized === 'FREELANCING') return 'FREELANCING';
      if (normalized === 'INTERNSHIP') return 'INTERNSHIP';
      if (normalized === 'JOB') return 'JOB';
      if (normalized === 'GOVT_JOB' || normalized === 'GOVT-JOB' || normalized === 'GOVTJOB') return 'GOVT_JOB';
      // If already a valid enum value, return as-is
      if (['JOB', 'INTERNSHIP', 'FREELANCING', 'GOVT_JOB'].includes(normalized)) {
        return normalized as 'JOB' | 'INTERNSHIP' | 'FREELANCING' | 'GOVT_JOB';
      }
      return undefined;
    };

    // Build post filter - query Post directly since CMS creates Post records
    const postFilter: any = { 
      isActive: true,
      postType: { in: ['JOB', 'INTERNSHIP', 'FREELANCING', 'GOVT_JOB'] },
    };
    
    // Filter by postType (include specific type) - excludeType takes precedence if both are provided
    if (filters.excludeType) {
      const normalizedExclude = normalizePostType(filters.excludeType);
      if (normalizedExclude) {
        postFilter.postType = { 
          in: ['JOB', 'INTERNSHIP', 'FREELANCING', 'GOVT_JOB'].filter(t => t !== normalizedExclude)
        };
      }
    } else if (filters.type) {
      const normalizedType = normalizePostType(filters.type);
      if (normalizedType) {
        postFilter.postType = normalizedType;
      }
    }

    // Build search filter
    if (filters.search) {
      postFilter.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Query Post directly and include JobPost if it exists
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where: postFilter,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          postType: true,
          images: true,
          createdAt: true,
          updatedAt: true,
          metadata: true,
          user: {
            select: {
              id: true,
              email: true,
              profileImage: true,
              companyProfile: {
                select: {
                  id: true,
                  companyName: true,
                  industry: true,
                },
              },
            },
          },
          jobPost: {
            select: {
              id: true,
              jobTitle: true,
              jobDescription: true,
              location: true,
              salaryMin: true,
              salaryMax: true,
              experience: true,
              skills: true,
              applicationDeadline: true,
              views: true,
              applications: true,
              _count: {
                select: {
                  jobApplications: true,
                },
              },
            },
          },
          _count: {
            select: {
              applications: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.post.count({ where: postFilter }),
    ]);

    // Transform posts to match JobPost format for mobile app compatibility
    const jobs = posts.map((post: any) => {
      const jobPost = post.jobPost;
      const metadata = post.metadata as any || {};
      
      // Extract company name from multiple locations (improved extraction)
      const companyName = 
        metadata.companyName || 
        (post as any).companyName || 
        post.user?.companyProfile?.companyName || 
        null;
      
      // Extract job function from metadata or post columns
      const jobFunction = 
        metadata.jobFunction || 
        (post as any).jobFunction || 
        null;
      
      // Extract industry from multiple locations
      const industry = 
        metadata.industry || 
        (post as any).industry || 
        post.user?.companyProfile?.industry || 
        null;
      
      // Extract work time from metadata or post columns
      const workTime = 
        metadata.workTime || 
        (post as any).workTime || 
        null;
      
      // Map postType to jobType for frontend compatibility
      // Priority: metadata.jobType > postType mapping
      let jobType: string | null = null;
      
      // First, check metadata for explicit jobType
      if (metadata.jobType || metadata.job_type || metadata.type) {
        jobType = metadata.jobType || metadata.job_type || metadata.type;
        // Normalize to lowercase for consistency
        if (jobType) {
          jobType = jobType.toLowerCase();
          // Map 'contract' variations to 'contract'
          if (jobType === 'contract' || jobType === 'contracting') {
            jobType = 'contract';
          } else if (jobType === 'freelance' || jobType === 'freelancing') {
            jobType = 'freelance';
          } else if (jobType === 'internship' || jobType === 'intern') {
            jobType = 'internship';
          }
        }
      } else {
        // Fallback to postType mapping if no metadata jobType
        if (post.postType === 'INTERNSHIP') {
          jobType = 'internship';
        } else if (post.postType === 'FREELANCING') {
          jobType = 'freelance'; // Default for freelancing
        }
        // For JOB and GOVT_JOB postType, jobType remains null (regular jobs)
      }

      return {
        id: jobPost?.id || post.id,
        postId: post.id,
        jobTitle: jobPost?.jobTitle || post.title,
        jobDescription: jobPost?.jobDescription || post.description,
        companyName, // Added company name
        jobFunction, // Added job function
        industry, // Added industry
        workTime, // Added work time
        location: jobPost?.location || metadata.jobLocation || null,
        salaryMin: jobPost?.salaryMin || metadata.salaryMin || null,
        salaryMax: jobPost?.salaryMax || metadata.salaryMax || null,
        experience: jobPost?.experience || metadata.experience || null,
        skills: jobPost?.skills || metadata.skills || [],
        applicationDeadline: jobPost?.applicationDeadline || null,
        views: jobPost?.views || 0,
        applications: jobPost?.applications || post._count.applications || 0,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        postType: post.postType,
        jobType: jobType, // Added jobType field for frontend filtering
        post: {
          id: post.id,
          postType: post.postType,
          user: post.user,
        },
        _count: {
          jobApplications: jobPost?._count?.jobApplications || post._count.applications || 0,
        },
      };
    });

    return {
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getJobById(id: string, userId?: string) {
    // Try to find as JobPost first
    let jobPost = await this.prisma.jobPost.findUnique({
      where: { id },
      include: {
        post: {
          include: {
            user: {
              include: {
                companyProfile: {
                  select: {
                    id: true,
                    companyName: true,
                    industry: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            jobApplications: true,
            viewActivities: true,
          },
        },
      },
    });

    // If not found as JobPost, try to find as Post ID
    let post = null;
    if (!jobPost) {
      post = await this.prisma.post.findUnique({
        where: { 
          id,
          postType: { in: ['JOB', 'INTERNSHIP', 'FREELANCING', 'GOVT_JOB'] },
        },
        include: {
          user: {
            include: {
              companyProfile: {
                select: {
                  id: true,
                  companyName: true,
                  industry: true,
                },
              },
            },
          },
          jobPost: {
            include: {
              _count: {
                select: {
                  jobApplications: true,
                  viewActivities: true,
                },
              },
            },
          },
          _count: {
            select: {
              applications: true,
            },
          },
        },
      });

      if (!post) {
        throw new NotFoundException('Job not found');
      }
    }

    // Transform to match expected format
    let job: any;
    
    if (jobPost) {
      // Handle JobPost case
      const metadata = jobPost.post?.metadata as any || {};
      const postData = jobPost.post as any;
      
      // Extract company name from multiple locations (improved extraction)
      const companyName = 
        metadata.companyName || 
        postData?.companyName || 
        jobPost.post?.user?.companyProfile?.companyName || 
        null;
      
      // Extract job function from metadata or post columns
      const jobFunction = 
        metadata.jobFunction || 
        postData?.jobFunction || 
        null;
      
      // Extract industry from multiple locations
      const industry = 
        metadata.industry || 
        postData?.industry || 
        jobPost.post?.user?.companyProfile?.industry || 
        null;
      
      // Extract work time from metadata or post columns
      const workTime = 
        metadata.workTime || 
        postData?.workTime || 
        null;
      
      // Map postType to jobType for frontend compatibility
      // Priority: metadata.jobType > postType mapping
      let jobType: string | null = null;
      const postType = jobPost.post?.postType;
      
      // First, check metadata for explicit jobType
      if (metadata.jobType || metadata.job_type || metadata.type) {
        jobType = metadata.jobType || metadata.job_type || metadata.type;
        // Normalize to lowercase for consistency
        if (jobType) {
          jobType = jobType.toLowerCase();
          // Map 'contract' variations to 'contract'
          if (jobType === 'contract' || jobType === 'contracting') {
            jobType = 'contract';
          } else if (jobType === 'freelance' || jobType === 'freelancing') {
            jobType = 'freelance';
          } else if (jobType === 'internship' || jobType === 'intern') {
            jobType = 'internship';
          }
        }
      } else {
        // Fallback to postType mapping if no metadata jobType
        if (postType === 'INTERNSHIP') {
          jobType = 'internship';
        } else if (postType === 'FREELANCING') {
          jobType = 'freelance'; // Default for freelancing
        }
        // For JOB and GOVT_JOB postType, jobType remains null (regular jobs)
      }

      job = {
        id: jobPost.id,
        postId: jobPost.postId,
        jobTitle: jobPost.jobTitle,
        jobDescription: jobPost.jobDescription,
        companyName, // Added company name
        jobFunction, // Added job function
        industry, // Added industry
        workTime, // Added work time
        location: jobPost.location,
        salaryMin: jobPost.salaryMin,
        salaryMax: jobPost.salaryMax,
        experience: jobPost.experience,
        skills: jobPost.skills || [],
        applicationDeadline: jobPost.applicationDeadline,
        views: jobPost.views || 0,
        applications: jobPost.applications || 0,
        createdAt: jobPost.post?.createdAt || jobPost.createdAt,
        updatedAt: jobPost.updatedAt,
        postType: postType,
        jobType: jobType, // Added jobType field for frontend filtering
        post: {
          id: jobPost.postId,
          postType: postType,
          user: jobPost.post?.user,
        },
        _count: {
          jobApplications: jobPost._count?.jobApplications || 0,
          viewActivities: jobPost._count?.viewActivities || 0,
        },
      };
    } else {
      // Handle Post case (when JobPost doesn't exist)
      job = (() => {
      const metadata = post.metadata as any || {};
      
      // Extract company name from multiple locations (improved extraction)
      const companyName = 
        metadata.companyName || 
        (post as any).companyName || 
        post.user?.companyProfile?.companyName || 
        null;
      
      // Extract job function from metadata or post columns
      const jobFunction = 
        metadata.jobFunction || 
        (post as any).jobFunction || 
        null;
      
      // Extract industry from multiple locations
      const industry = 
        metadata.industry || 
        (post as any).industry || 
        post.user?.companyProfile?.industry || 
        null;
      
      // Extract work time from metadata or post columns
      const workTime = 
        metadata.workTime || 
        (post as any).workTime || 
        null;
      
      // Map postType to jobType for frontend compatibility
      // Priority: metadata.jobType > postType mapping
      let jobType: string | null = null;
      
      // First, check metadata for explicit jobType
      if (metadata.jobType || metadata.job_type || metadata.type) {
        jobType = metadata.jobType || metadata.job_type || metadata.type;
        // Normalize to lowercase for consistency
        if (jobType) {
          jobType = jobType.toLowerCase();
          // Map 'contract' variations to 'contract'
          if (jobType === 'contract' || jobType === 'contracting') {
            jobType = 'contract';
          } else if (jobType === 'freelance' || jobType === 'freelancing') {
            jobType = 'freelance';
          } else if (jobType === 'internship' || jobType === 'intern') {
            jobType = 'internship';
          }
        }
      } else {
        // Fallback to postType mapping if no metadata jobType
        if (post.postType === 'INTERNSHIP') {
          jobType = 'internship';
        } else if (post.postType === 'FREELANCING') {
          jobType = 'freelance'; // Default for freelancing
        }
        // For JOB and GOVT_JOB postType, jobType remains null (regular jobs)
      }

      return {
        id: post.jobPost?.id || post.id,
        postId: post.id,
        jobTitle: post.jobPost?.jobTitle || post.title,
        jobDescription: post.jobPost?.jobDescription || post.description,
        companyName, // Added company name
        jobFunction, // Added job function
        industry, // Added industry
        workTime, // Added work time
        location: post.jobPost?.location || metadata.jobLocation || null,
        salaryMin: post.jobPost?.salaryMin || metadata.salaryMin || null,
        salaryMax: post.jobPost?.salaryMax || metadata.salaryMax || null,
        experience: post.jobPost?.experience || metadata.experience || null,
        skills: post.jobPost?.skills || metadata.skills || [],
        applicationDeadline: post.jobPost?.applicationDeadline || null,
        views: post.jobPost?.views || 0,
        applications: post.jobPost?.applications || post._count.applications || 0,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        postType: post.postType,
        jobType: jobType, // Added jobType field for frontend filtering
        post: {
          id: post.id,
          postType: post.postType,
          user: post.user,
        },
        _count: {
          jobApplications: post.jobPost?._count?.jobApplications || post._count.applications || 0,
          viewActivities: post.jobPost?._count?.viewActivities || 0,
        },
      };
      })();
    }

    // Track view
    if (userId) {
      const jobPostId = jobPost?.id || post?.jobPost?.id;
      if (jobPostId) {
        await this.prisma.jobViewActivity.create({
          data: {
            jobPostId,
            userId,
          },
        });

        await this.prisma.jobPost.update({
          where: { id: jobPostId },
          data: { views: { increment: 1 } },
        });
      }

      await this.analytics.trackEvent(userId, 'job_view', 'job', job.id);
    }

    return job;
  }

  async applyForJob(userId: string, jobPostId: string, postId: string, coverLetter?: string) {
    // First, get the Post to understand the job structure
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { jobPost: true },
    });

    if (!post) {
      throw new NotFoundException('Job not found');
    }

    // Check if Post has a JobPost
    let jobPost = post.jobPost;
    let actualJobPostId: string;

    if (jobPost) {
      // JobPost exists, use it
      actualJobPostId = jobPost.id;
    } else {
      // No JobPost exists (CMS job), create one from Post data
      const metadata = post.metadata as any || {};
      jobPost = await this.prisma.jobPost.create({
        data: {
          postId: post.id,
          jobTitle: post.title,
          jobDescription: post.description,
          location: metadata.jobLocation || null,
          salaryMin: metadata.salaryMin || null,
          salaryMax: metadata.salaryMax || null,
          experience: metadata.experience || null,
          skills: metadata.skills || [],
          views: 0,
          applications: 0,
        },
      });
      actualJobPostId = jobPost.id;
    }

    // Check if user already applied
    const existing = await this.prisma.jobApplication.findFirst({
      where: {
        userId,
        postId,
      },
    });

    if (existing) {
      throw new BadRequestException('Already applied for this job');
    }

    // Create application
    try {
      const application = await this.prisma.jobApplication.create({
        data: {
          userId,
          jobPostId: actualJobPostId,
          postId,
          coverLetter,
          status: 'pending',
        },
      });

      // Update application count (non-blocking - don't wait)
      this.prisma.jobPost.update({
        where: { id: actualJobPostId },
        data: { applications: { increment: 1 } },
      }).catch((err) => {
        console.error('Failed to update application count:', err);
      });

      // Track analytics event (fire and forget - don't block response)
      this.analytics.trackEvent(userId, 'job_apply', 'job', actualJobPostId).catch((analyticsError) => {
        console.error('Analytics tracking failed:', analyticsError);
      });

      // Return immediately - don't wait for analytics or count update
      return application;
    } catch (error: any) {
      // Log the actual error for debugging
      console.error('Error creating job application:', {
        error: error.message,
        code: error.code,
        userId,
        jobPostId: actualJobPostId,
        postId,
      });
      
      // Handle specific Prisma errors
      if (error.code === 'P2002') {
        throw new BadRequestException('You have already applied for this job');
      }
      
      // Re-throw with better message
      throw new BadRequestException(error.message || 'Failed to submit application. Please try again.');
    }
  }

  async getApplications(jobPostId: string) {
    return this.prisma.jobApplication.findMany({
      where: { jobPostId },
      include: {
        user: {
          include: {
            studentProfile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async shortlistCandidate(applicationId: string, status: string) {
    return this.prisma.jobApplication.update({
      where: { id: applicationId },
      data: { status },
    });
  }

  async getAppliedJobs(userId: string, filters: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = parseInt(String(filters.page || 1), 10);
    const limit = parseInt(String(filters.limit || 20), 10);
    const skip = (page - 1) * limit;

    const where: any = {
      userId,
      jobPost: {
        post: { isActive: true },
      },
    };

    if (filters.search) {
      where.OR = [
        { jobPost: { jobTitle: { contains: filters.search, mode: 'insensitive' } } },
        { jobPost: { jobDescription: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [applications, total] = await Promise.all([
      this.prisma.jobApplication.findMany({
        where,
        skip,
        take: limit,
        include: {
          jobPost: {
            include: {
              post: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      profileImage: true,
                    },
                  },
                },
              },
              _count: {
                select: {
                  jobApplications: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.jobApplication.count({ where }),
    ]);

    // Transform to match jobs format
    const jobs = applications.map((app) => ({
      ...app.jobPost,
      applicationStatus: app.status,
      appliedAt: app.createdAt,
    }));

    return {
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteJob(id: string) {
    // Try to find as JobPost ID first
    let jobPost = await this.prisma.jobPost.findUnique({
      where: { id },
      include: { post: true },
    });

    let postId: string;

    if (jobPost) {
      // Found as JobPost ID
      postId = jobPost.postId;
    } else {
      // Try to find as Post ID with postType='JOB'
      const post = await this.prisma.post.findUnique({
        where: { id },
      });

      if (!post) {
        throw new NotFoundException('Job not found');
      }

      if (post.postType !== 'JOB') {
        throw new NotFoundException('Post is not a job');
      }

      postId = post.id;
    }

    // Soft delete by setting isActive=false
    return this.prisma.post.update({
      where: { id: postId },
      data: { isActive: false },
    });
  }

  async hardDeleteJob(id: string) {
    // Try to find as JobPost ID first
    let jobPost = await this.prisma.jobPost.findUnique({
      where: { id },
      include: { post: true },
    });

    let postId: string;

    if (jobPost) {
      // Found as JobPost ID
      postId = jobPost.postId;
    } else {
      // Try to find as Post ID with postType='JOB'
      const post = await this.prisma.post.findUnique({
        where: { id },
      });

      if (!post) {
        throw new NotFoundException('Job not found');
      }

      if (post.postType !== 'JOB') {
        throw new NotFoundException('Post is not a job');
      }

      postId = post.id;
    }

    // Hard delete the Post (this will cascade delete JobPost and all related records)
    return this.prisma.post.delete({
      where: { id: postId },
    });
  }
}

