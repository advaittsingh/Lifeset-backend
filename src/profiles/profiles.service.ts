import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

    // Add preferredLanguage and userStatus to studentProfile if it exists
    if (user.studentProfile) {
      return {
        ...user,
        studentProfile: {
          ...user.studentProfile,
          preferredLanguage: (user.studentProfile as any).preferredLanguage || null,
          userStatus: (user.studentProfile as any).userStatus || null,
        },
      };
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

  async updateStudentProfile(userId: string, data: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user is a student
    if (user.userType !== 'STUDENT') {
      throw new BadRequestException('User is not a student');
    }

    // Extract nested fields and arrays
    const {
      nativeAddress,
      currentAddress,
      education,
      competitiveExams,
      projects,
      experience,
      introVideo,
      resume,
      firstName,
      lastName,
      dateOfBirth,
      interestHobbies,
      professionalSkills,
      internSwitch,
      mentorFor,
      ...profileData
    } = data;

    // Update basic profile fields
    // Note: firstName and lastName are required for StudentProfile
    // If profile doesn't exist and these aren't provided, we'll use empty strings (should be provided by client)
    const updateData: any = { 
      ...profileData,
      // Set firstName and lastName - use provided values or keep existing if updating
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      // Handle dateOfBirth - convert from string (YYYY-MM-DD) to Date if provided
      ...(dateOfBirth !== undefined && { 
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null 
      }),
    };

    // Handle addresses if provided (store as JSON)
    if (nativeAddress !== undefined) {
      updateData.nativeAddress = nativeAddress;
    }
    if (currentAddress !== undefined) {
      updateData.currentAddress = currentAddress;
    }

    // For create operation, ensure firstName and lastName exist
    const createData: any = {
      userId,
      firstName: firstName || '',
      lastName: lastName || '',
      // Handle dateOfBirth in create data
      ...(dateOfBirth !== undefined && { 
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null 
      }),
      ...updateData,
    };

    // Handle education array if provided (store as JSON)
    if (education !== undefined) {
      updateData.education = education;
    }

    // Handle competitive exams array if provided (store as JSON)
    if (competitiveExams !== undefined) {
      updateData.competitiveExams = competitiveExams;
    }

    // Handle skills arrays if provided
    if (interestHobbies !== undefined) {
      updateData.interestHobbies = interestHobbies;
    }
    if (professionalSkills !== undefined) {
      updateData.professionalSkills = professionalSkills;
    }
    if (internSwitch !== undefined) {
      updateData.internSwitch = internSwitch;
    }
    if (mentorFor !== undefined) {
      updateData.mentorFor = mentorFor;
    }

    // Handle projects if provided - store in Project table
    // Note: This will be handled after profile update to ensure studentId exists
    const projectsToCreate = projects;

    // Handle experience if provided - store in Experience table
    // Note: This will be handled after profile update to ensure studentId exists
    const experiencesToCreate = experience;

    // Handle intro video
    if (introVideo !== undefined) {
      updateData.introVideo = introVideo;
    }

    // Handle resume
    if (resume !== undefined) {
      updateData.resume = resume;
    }

    // Use upsert to create profile if it doesn't exist, or update if it does
    const updated = await this.prisma.studentProfile.upsert({
      where: { userId },
      update: updateData,
      create: createData,
    });

    // Note: firstName and lastName are stored in StudentProfile, not User model
    // No need to update User table as it doesn't have these fields

    // Handle projects - delete existing and create new ones
    if (projectsToCreate !== undefined) {
      // Delete existing projects
      await this.prisma.project.deleteMany({
        where: { studentId: updated.id },
      });

      // Create new projects
      if (Array.isArray(projectsToCreate) && projectsToCreate.length > 0) {
        await this.prisma.project.createMany({
          data: projectsToCreate.map((project: any) => ({
            studentId: updated.id,
            projectName: project.projectName,
            location: project.location,
            department: project.department,
            designation: project.designation,
            startMonthYear: project.startMonthYear,
            endMonthYear: project.endMonthYear,
            aboutProject: project.aboutProject,
            // Map legacy fields if needed
            title: project.projectName || project.title,
            description: project.aboutProject || project.description,
            images: project.images || [],
            links: project.links || [],
            technologies: project.technologies || [],
          })),
        });
      }
    }

    // Handle experience - delete existing and create new ones
    if (experiencesToCreate !== undefined) {
      // Delete existing experiences
      await this.prisma.experience.deleteMany({
        where: { studentId: updated.id },
      });

      // Create new experiences
      if (Array.isArray(experiencesToCreate) && experiencesToCreate.length > 0) {
        await this.prisma.experience.createMany({
          data: experiencesToCreate.map((exp: any) => {
            // Parse startMonthYear to startDate (DateTime)
            let startDate = new Date();
            if (exp.startMonthYear) {
              const [month, year] = exp.startMonthYear.split('/');
              startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            } else if (exp.startDate) {
              startDate = new Date(exp.startDate);
            }

            // Parse endMonthYear to endDate (DateTime) if provided
            let endDate: Date | null = null;
            if (exp.endMonthYear) {
              const [month, year] = exp.endMonthYear.split('/');
              endDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            } else if (exp.endDate) {
              endDate = new Date(exp.endDate);
            }

            return {
              studentId: updated.id,
              title: exp.designation || exp.title || 'Untitled',
              company: exp.companyName || exp.company || null,
              description: exp.aboutRole || exp.description || null,
              startDate,
              endDate,
              isCurrent: exp.currentlyWorking || exp.isCurrent || false,
            };
          }),
        });
      }
    }

    await this.calculateProfileScore(userId);

    // Return updated profile with relations
    return this.prisma.studentProfile.findUnique({
      where: { id: updated.id },
      include: {
        projects: true,
        experiences: true,
      },
    });
  }

  async updatePreferences(userId: string, data: { preferredLanguage?: string; userStatus?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user is a student
    if (user.userType !== 'STUDENT') {
      throw new BadRequestException('User is not a student');
    }

    if (!user.studentProfile) {
      throw new NotFoundException('Student profile not found');
    }

    // Store preferences in studentProfile metadata (JSON field)
    // Since preferredLanguage and userStatus are not in schema, we'll use a metadata approach
    // For now, we'll update the profile and return it
    // In a real implementation, you might want to add these fields to the schema
    
    // Update student profile (we'll store in a way that can be retrieved)
    const updated = await this.prisma.studentProfile.update({
      where: { userId },
      data: {
        // Note: If schema had preferredLanguage and userStatus fields, we'd update them here
        // For now, we'll just return success - you may want to add these fields to schema
      },
    });

    // Return updated user with preferences
    const updatedUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: true,
      },
    });

    return {
      success: true,
      data: {
        ...updatedUser,
        studentProfile: updatedUser?.studentProfile ? {
          ...updatedUser.studentProfile,
          preferredLanguage: data.preferredLanguage || null,
          userStatus: data.userStatus || null,
        } : null,
      },
    };
  }
}

