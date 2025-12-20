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

    // Return user with studentProfile (preferredLanguage and userStatus are now in schema)
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

    // Define valid StudentProfile fields from schema
    const validFields = [
      'firstName', 'lastName', 'dateOfBirth', 'gender', 'address', 'city', 'state', 'pincode',
      'profileImage', 'voiceRecording', 'profileScore', 'collegeId', 'collegeProfileId', 'courseId',
      'preferredLanguage', 'userStatus',
      'education10th', 'education12th', 'graduation', 'postGraduation',
      'technicalSkills', 'softSkills'
    ];

    // Extract nested fields and arrays (not direct StudentProfile fields)
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
      profilePicture, // Map to profileImage
      languageKnown, // Map to preferredLanguage
      category, // Not in schema - ignore
      religion, // Not in schema - ignore
      fatherName, // Not in schema - ignore
      fatherHighestDegree, // Not in schema - ignore
      fatherOccupation, // Not in schema - ignore
      motherName, // Not in schema - ignore
      motherHighestDegree, // Not in schema - ignore
      motherOccupation, // Not in schema - ignore
      ...profileData
    } = data;

    // Filter and map profile data - only include valid fields
    const updateData: any = {};
    
    // Map profilePicture to profileImage
    if (profilePicture !== undefined) {
      updateData.profileImage = profilePicture || null;
    }
    
    // Map languageKnown to preferredLanguage
    if (languageKnown !== undefined) {
      updateData.preferredLanguage = languageKnown || null;
    }

    // Only include valid fields from profileData
    for (const [key, value] of Object.entries(profileData)) {
      if (validFields.includes(key)) {
        // Convert empty strings to null for optional fields
        if (value === '' && key !== 'firstName' && key !== 'lastName') {
          updateData[key] = null;
        } else {
          updateData[key] = value;
        }
      }
      // Ignore unknown fields (category, religion, fatherName, etc.)
    }

    // Handle firstName and lastName - required fields, but allow empty strings for partial saves
    if (firstName !== undefined) {
      updateData.firstName = firstName || '';
    }
    if (lastName !== undefined) {
      updateData.lastName = lastName || '';
    }

    // Handle dateOfBirth - convert from string (YYYY-MM-DD) to Date if provided
    if (dateOfBirth !== undefined) {
      updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }

    // Handle userStatus conversion if provided
    if (updateData.userStatus && typeof updateData.userStatus === 'string') {
      const statusLower = updateData.userStatus.toLowerCase();
      if (statusLower === 'school') {
        updateData.userStatus = 'SCHOOL';
      } else if (statusLower === 'college') {
        updateData.userStatus = 'COLLEGE';
      } else if (statusLower === 'working_professional') {
        updateData.userStatus = 'WORKING_PROFESSIONAL';
      }
    }

    // Handle addresses if provided (store as JSON in education fields if needed)
    // Note: nativeAddress and currentAddress are not in schema, so we'll skip them
    // If you need to store them, consider adding to schema or storing in metadata

    // For create operation, ensure firstName and lastName exist
    const createData: any = {
      userId,
      firstName: updateData.firstName !== undefined ? updateData.firstName : (firstName || ''),
      lastName: updateData.lastName !== undefined ? updateData.lastName : (lastName || ''),
      ...updateData,
    };

    // Handle education fields if provided (store as JSON)
    // Note: These fields are in schema as education10th, education12th, graduation, postGraduation
    if (education !== undefined) {
      // If education is an object with specific fields, map them
      if (typeof education === 'object' && education !== null) {
        if (education.education10th !== undefined) updateData.education10th = education.education10th;
        if (education.education12th !== undefined) updateData.education12th = education.education12th;
        if (education.graduation !== undefined) updateData.graduation = education.graduation;
        if (education.postGraduation !== undefined) updateData.postGraduation = education.postGraduation;
      }
    }

    // Note: competitiveExams, interestHobbies, professionalSkills, internSwitch, mentorFor
    // are not in the current schema - they are ignored
    // If needed, they can be stored in metadata or added to schema

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
    // Only include fields that are actually provided (partial save support)
    const updateFields: any = {};
    const createFields: any = { ...createData };

    // For update: only include fields that are explicitly provided (not undefined)
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        updateFields[key] = updateData[key];
      }
    });

    // Ensure firstName and lastName for create
    if (!createFields.firstName) createFields.firstName = '';
    if (!createFields.lastName) createFields.lastName = '';

    const updated = await this.prisma.studentProfile.upsert({
      where: { userId },
      update: updateFields, // Only update provided fields
      create: createFields,
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

  async updatePreferences(userId: string, data: { preferredLanguage?: string; userStatus?: 'school' | 'college' | 'working_professional' }): Promise<{ success: boolean; data: any }> {
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

    // Validate userStatus if provided
    if (data.userStatus && !['school', 'college', 'working_professional'].includes(data.userStatus)) {
      throw new BadRequestException('userStatus must be one of: school, college, working_professional');
    }

    // Convert lowercase string to enum value
    // 'school' -> 'SCHOOL', 'college' -> 'COLLEGE', 'working_professional' -> 'WORKING_PROFESSIONAL'
    let userStatusEnum: 'SCHOOL' | 'COLLEGE' | 'WORKING_PROFESSIONAL' | undefined = undefined;
    if (data.userStatus) {
      if (data.userStatus === 'school') {
        userStatusEnum = 'SCHOOL';
      } else if (data.userStatus === 'college') {
        userStatusEnum = 'COLLEGE';
      } else if (data.userStatus === 'working_professional') {
        userStatusEnum = 'WORKING_PROFESSIONAL';
      }
    }

    // Update student profile
    const updated = await this.prisma.studentProfile.update({
      where: { userId },
      data: {
        preferredLanguage: data.preferredLanguage !== undefined ? data.preferredLanguage : undefined,
        userStatus: userStatusEnum,
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
      data: updatedUser,
    };
  }
}

