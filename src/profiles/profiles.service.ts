import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    try {
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
    } catch (error: any) {
      // Re-throw known exceptions
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Log and wrap unexpected errors
      this.logger.error(`Error fetching user profile for user ${userId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch user profile. Please try again.');
    }
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
    // Log incoming data for debugging
    this.logger.log(`📝 updateStudentProfile called for user ${userId}`, {
      fieldsReceived: Object.keys(data),
      hasProjects: !!data.projects,
      hasExperience: !!(data.experience || data.experiences),
      hasEducation: !!data.education,
    });

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
      // Personal Details - Family Info
      'category', 'religion', 'fatherName', 'fatherHighestDegree', 'fatherOccupation',
      'motherName', 'motherHighestDegree', 'motherOccupation',
      // Addresses
      'nativeAddress', 'currentAddress',
      // Education
      'education', 'education10th', 'education12th', 'graduation', 'postGraduation',
      // Skills
      'technicalSkills', 'softSkills', 'interestHobbies', 'professionalSkills',
      'internSwitch', 'mentorFor',
      // Competitive Exams
      'competitiveExams',
      // Media
      'introVideo', 'resume'
    ];

    // Extract nested fields and arrays (not direct StudentProfile fields)
    const {
      nativeAddress,
      currentAddress,
      education,
      competitiveExams,
      projects,
      experience,
      experiences, // Also check for 'experiences' plural
      introVideo,
      resume,
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

    // Build updateData object - process ALL fields from data, not just profileData
    const updateData: any = {};
    
    // Map profilePicture to profileImage
    if (data.profilePicture !== undefined) {
      updateData.profileImage = data.profilePicture || null;
    }
    
    // Map languageKnown to preferredLanguage
    if (data.languageKnown !== undefined) {
      updateData.preferredLanguage = data.languageKnown || null;
    }

    // Process all fields from the original data object
    for (const [key, value] of Object.entries(data)) {
      // Skip nested objects and arrays that are handled separately
      if (['projects', 'experience', 'experiences', 'profilePicture', 'languageKnown'].includes(key)) {
        continue;
      }

      // Only include valid StudentProfile fields
      if (validFields.includes(key)) {
        // Convert empty strings to null for optional fields (except firstName/lastName)
        if (value === '' && key !== 'firstName' && key !== 'lastName') {
          updateData[key] = null;
        } else if (value !== undefined && value !== null) {
          updateData[key] = value;
        }
      }
    }

    // Handle firstName and lastName - required fields, but allow empty strings for partial saves
    if (data.firstName !== undefined) {
      updateData.firstName = data.firstName || '';
    }
    if (data.lastName !== undefined) {
      updateData.lastName = data.lastName || '';
    }

    // Handle dateOfBirth - convert from string (YYYY-MM-DD) to Date if provided
    if (data.dateOfBirth !== undefined) {
      updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    }

    // Handle userStatus conversion if provided
    if (data.userStatus !== undefined && typeof data.userStatus === 'string') {
      const statusLower = data.userStatus.toLowerCase();
      if (statusLower === 'school') {
        updateData.userStatus = 'SCHOOL';
      } else if (statusLower === 'college') {
        updateData.userStatus = 'COLLEGE';
      } else if (statusLower === 'working_professional') {
        updateData.userStatus = 'WORKING_PROFESSIONAL';
      } else {
        updateData.userStatus = data.userStatus; // Keep as-is if already enum value
      }
    }

    // Handle education - store as JSON array
    if (education !== undefined) {
      if (Array.isArray(education)) {
        // Store education array directly
        updateData.education = education;
      } else if (typeof education === 'object' && education !== null) {
        // Support legacy format with separate fields
        if (education.education10th !== undefined) updateData.education10th = education.education10th;
        if (education.education12th !== undefined) updateData.education12th = education.education12th;
        if (education.graduation !== undefined) updateData.graduation = education.graduation;
        if (education.postGraduation !== undefined) updateData.postGraduation = education.postGraduation;
      }
    }
    
    // Also check for direct education fields (legacy support)
    if (data.education !== undefined && Array.isArray(data.education)) {
      updateData.education = data.education;
    }
    if (data.education10th !== undefined) updateData.education10th = data.education10th;
    if (data.education12th !== undefined) updateData.education12th = data.education12th;
    if (data.graduation !== undefined) updateData.graduation = data.graduation;
    if (data.postGraduation !== undefined) updateData.postGraduation = data.postGraduation;

    // Handle addresses (store as JSON)
    if (nativeAddress !== undefined) {
      updateData.nativeAddress = nativeAddress;
    }
    if (currentAddress !== undefined) {
      updateData.currentAddress = currentAddress;
    }

    // Handle competitive exams (store as JSON array)
    if (competitiveExams !== undefined) {
      updateData.competitiveExams = Array.isArray(competitiveExams) ? competitiveExams : [];
    }

    // Handle skills arrays
    if (data.technicalSkills !== undefined) {
      updateData.technicalSkills = Array.isArray(data.technicalSkills) ? data.technicalSkills : [];
    }
    if (data.softSkills !== undefined) {
      updateData.softSkills = Array.isArray(data.softSkills) ? data.softSkills : [];
    }
    if (interestHobbies !== undefined) {
      updateData.interestHobbies = Array.isArray(interestHobbies) ? interestHobbies : [];
    }
    if (professionalSkills !== undefined) {
      updateData.professionalSkills = Array.isArray(professionalSkills) ? professionalSkills : [];
    }

    // Handle text fields
    if (internSwitch !== undefined) {
      updateData.internSwitch = internSwitch || null;
    }
    if (mentorFor !== undefined) {
      updateData.mentorFor = mentorFor || null;
    }
    if (introVideo !== undefined) {
      updateData.introVideo = introVideo || null;
    }
    if (resume !== undefined) {
      updateData.resume = resume || null;
    }

    // Handle projects if provided - store in Project table
    const projectsToCreate = projects || data.projects;

    // Handle experience if provided - store in Experience table (support both 'experience' and 'experiences')
    const experiencesToCreate = experience || experiences || data.experience || data.experiences;

    // Use upsert to create profile if it doesn't exist, or update if it does
    // Only include fields that are actually provided (partial save support)
    const updateFields: any = {};
    
    // For update: only include fields that are explicitly provided (not undefined)
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        updateFields[key] = updateData[key];
      }
    });

    // For create: ensure required fields exist
    const createFields: any = {
      userId,
      firstName: updateData.firstName !== undefined ? updateData.firstName : '',
      lastName: updateData.lastName !== undefined ? updateData.lastName : '',
      ...updateData,
    };

    // Ensure firstName and lastName for create
    if (!createFields.firstName) createFields.firstName = '';
    if (!createFields.lastName) createFields.lastName = '';

    // Log what will be saved
    this.logger.log(`💾 Saving profile for user ${userId}`, {
      updateFields: Object.keys(updateFields),
      hasProjects: !!projectsToCreate,
      hasExperiences: !!experiencesToCreate,
    });

    const updated = await this.prisma.studentProfile.upsert({
      where: { userId },
      update: updateFields, // Only update provided fields
      create: createFields,
    });

    this.logger.log(`✅ Profile saved successfully for user ${userId}`, {
      profileId: updated.id,
      fieldsUpdated: Object.keys(updateFields).length,
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
            // New fields
            projectName: project.projectName || project.title || 'Untitled Project',
            location: project.location || null,
            department: project.department || null,
            designation: project.designation || null,
            startMonthYear: project.startMonthYear || null,
            endMonthYear: project.endMonthYear || null,
            aboutProject: project.aboutProject || project.description || '',
            // Legacy fields (required)
            title: project.projectName || project.title || 'Untitled Project',
            description: project.aboutProject || project.description || '',
            images: project.images || [],
            links: project.links || [],
            technologies: project.technologies || [],
          })),
        });
      }
    }

    // Handle experience - delete existing and create new ones
    if (experiencesToCreate !== undefined) {
      this.logger.log(`📝 Processing experiences for user ${userId}`, {
        count: Array.isArray(experiencesToCreate) ? experiencesToCreate.length : 'not an array',
        type: typeof experiencesToCreate,
      });

      // Delete existing experiences
      try {
        await this.prisma.experience.deleteMany({
          where: { studentId: updated.id },
        });
        this.logger.log(`✅ Deleted existing experiences for user ${userId}`);
      } catch (deleteError: any) {
        this.logger.warn(`⚠️ Error deleting existing experiences for user ${userId}: ${deleteError.message}`);
        // Continue even if delete fails - might be first time creating experiences
      }

      // Create new experiences (handle both empty array and non-empty array)
      if (Array.isArray(experiencesToCreate)) {
        if (experiencesToCreate.length > 0) {
          try {
            const experienceData = experiencesToCreate.map((exp: any, index: number) => {
              // Ensure required fields have defaults
              const title = exp.designation || exp.title || `Experience ${index + 1}`;
              
              // Parse startMonthYear to startDate (DateTime) with validation
              let startDate: Date;
              try {
                if (exp.startMonthYear) {
                  const parts = exp.startMonthYear.split('/');
                  if (parts.length === 2) {
                    const month = parseInt(parts[0], 10);
                    const year = parseInt(parts[1], 10);
                    if (month >= 1 && month <= 12 && year > 1900 && year <= 2100) {
                      startDate = new Date(year, month - 1, 1);
                    } else {
                      this.logger.warn(`Invalid date format for startMonthYear: ${exp.startMonthYear}, using current date`);
                      startDate = new Date();
                    }
                  } else {
                    this.logger.warn(`Invalid startMonthYear format: ${exp.startMonthYear}, expected MM/YYYY`);
                    startDate = new Date();
                  }
                } else if (exp.startDate) {
                  startDate = new Date(exp.startDate);
                  // Validate the date
                  if (isNaN(startDate.getTime())) {
                    this.logger.warn(`Invalid startDate: ${exp.startDate}, using current date`);
                    startDate = new Date();
                  }
                } else {
                  // Default to current date if no start date provided
                  startDate = new Date();
                }
                } catch (dateError: any) {
                this.logger.error(`Error parsing start date for experience ${index + 1}: ${dateError.message}`);
                startDate = new Date();
              }

              // Parse endMonthYear to endDate (DateTime) if provided
              let endDate: Date | null = null;
              if (!exp.currentlyWorking && !exp.isCurrent) {
                try {
                  if (exp.endMonthYear) {
                    const parts = exp.endMonthYear.split('/');
                    if (parts.length === 2) {
                      const month = parseInt(parts[0], 10);
                      const year = parseInt(parts[1], 10);
                      if (month >= 1 && month <= 12 && year > 1900 && year <= 2100) {
                        endDate = new Date(year, month - 1, 1);
                      } else {
                        this.logger.warn(`Invalid date format for endMonthYear: ${exp.endMonthYear}`);
                      }
                    }
                  } else if (exp.endDate) {
                    endDate = new Date(exp.endDate);
                    if (isNaN(endDate.getTime())) {
                      this.logger.warn(`Invalid endDate: ${exp.endDate}`);
                      endDate = null;
                    }
                  }
                } catch (dateError: any) {
                  this.logger.error(`Error parsing end date for experience ${index + 1}: ${dateError.message}`);
                  endDate = null;
                }
              }

              return {
                studentId: updated.id,
                // Required field: title (must not be null/empty)
                title: title,
                // New fields
                companyName: exp.companyName || exp.company || null,
                company: exp.companyName || exp.company || null,
                isFacultyMember: exp.isFacultyMember || false,
                location: exp.location || null,
                department: exp.department || null,
                designation: exp.designation || exp.title || title,
                startMonthYear: exp.startMonthYear || null,
                endMonthYear: exp.endMonthYear || null,
                aboutRole: exp.aboutRole || exp.description || null,
                description: exp.aboutRole || exp.description || null,
                currentlyWorking: exp.currentlyWorking || exp.isCurrent || false,
                isCurrent: exp.currentlyWorking || exp.isCurrent || false,
                // Required DateTime field
                startDate,
                // Optional DateTime field
                endDate,
              };
            });

            this.logger.log(`💾 Creating ${experienceData.length} experience records for user ${userId}...`);
            await this.prisma.experience.createMany({
              data: experienceData,
              skipDuplicates: true, // Skip duplicates if any
            });
            this.logger.log(`✅ Successfully created ${experienceData.length} experience records for user ${userId}`);
          } catch (createError: any) {
            this.logger.error(`❌ Error creating experiences for user ${userId}`, {
              message: createError.message,
              code: createError.code,
              meta: createError.meta,
            });
            throw new BadRequestException(
              `Failed to save experiences: ${createError.message}. Please check the data format.`
            );
          }
        } else {
          this.logger.log(`ℹ️ Empty experiences array - all experiences removed for user ${userId}`);
        }
      } else {
        this.logger.warn(`⚠️ experiencesToCreate is not an array for user ${userId}: ${typeof experiencesToCreate}`);
        throw new BadRequestException('Experiences must be an array');
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

