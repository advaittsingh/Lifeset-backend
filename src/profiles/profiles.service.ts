import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { detectDatabaseError, logErrorWithDatabaseDetection } from '../common/utils/database-error-detector.util';

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

      // Transform response to include compatibility fields for mobile app
      if (user.studentProfile) {
        // Map preferredLanguage to languageKnown for compatibility
        (user.studentProfile as any).languageKnown = user.studentProfile.preferredLanguage || '';
        // Map experiences relation to experience array for compatibility
        (user.studentProfile as any).experience = user.studentProfile.experiences || [];
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
      include: {
        experiences: true,
        projects: true,
      },
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
      include: {
        experiences: true,
        projects: true,
      },
    });

    if (!profile) {
      return {
        completion: 0,
        score: 0,
        sections: {
          education: 0,
          skills: 0,
          competitiveExams: 0,
          projects: 0,
          experience: 0,
          introVideo: 0,
        },
        // Required fields check for networking
        isComplete: false,
        missingFields: {
          personalInfo: true,
          address: true,
          education: true,
        },
      };
    }

    // Check required fields for networking (personal info, address, education)
    // Helper to safely trim strings
    const safeTrim = (val: any): string => {
      if (!val) return '';
      if (typeof val === 'string') return val.trim();
      return String(val).trim();
    };
    
    const personalInfoComplete = !!(
      safeTrim(profile.firstName) &&
      safeTrim(profile.lastName) &&
      profile.dateOfBirth &&
      safeTrim(profile.gender)
    );

    const addressComplete = !!(
      safeTrim(profile.address) &&
      safeTrim(profile.city) &&
      safeTrim(profile.state) &&
      safeTrim(profile.pincode)
    );

    // Check if any education field has data
    // Education fields are JSON, so they might be objects, strings, or null
    const checkEducationField = (field: any): boolean => {
      if (!field) return false;
      if (typeof field === 'string') {
        try {
          const parsed = JSON.parse(field);
          return typeof parsed === 'object' && Object.keys(parsed).length > 0;
        } catch {
          return field.trim().length > 0;
        }
      }
      if (typeof field === 'object') {
        // Check if it's an empty object
        if (Object.keys(field).length === 0) return false;
        // Check if any value is non-empty
        return Object.values(field).some((val: any) => {
          if (val === null || val === undefined) return false;
          if (typeof val === 'string') return val.trim().length > 0;
          return true;
        });
      }
      return false;
    };
    
    const hasEducation10th = checkEducationField(profile.education10th);
    const hasEducation12th = checkEducationField(profile.education12th);
    const hasGraduation = checkEducationField(profile.graduation);
    const hasPostGraduation = checkEducationField(profile.postGraduation);
    const educationComplete = !!(hasEducation10th || hasEducation12th || hasGraduation || hasPostGraduation);
    
    // Log for debugging
    this.logger.log(`Profile completion check for user ${userId}:`, {
      personalInfoComplete,
      addressComplete,
      educationComplete,
      hasEducation10th,
      hasEducation12th,
      hasGraduation,
      hasPostGraduation,
      firstName: profile.firstName,
      lastName: profile.lastName,
      dateOfBirth: profile.dateOfBirth,
      gender: profile.gender,
      address: profile.address,
      city: profile.city,
      state: profile.state,
      pincode: profile.pincode,
    });

    // Calculate individual section completion percentages
    const sections = {
      // Education: Check if any education field is filled
      education: (profile.education10th || profile.education12th || profile.graduation || profile.postGraduation || profile.education) ? 100 : 0,
      
      // Skills: Check if technical or soft skills exist
      skills: (profile.technicalSkills.length > 0 || profile.softSkills.length > 0) ? 100 : 0,
      
      // Competitive Exams: Check if competitiveExams array exists and has entries
      competitiveExams: (profile.competitiveExams && 
        (Array.isArray(profile.competitiveExams) ? profile.competitiveExams.length > 0 : Object.keys(profile.competitiveExams).length > 0)) ? 100 : 0,
      
      // Projects: Check if projects exist
      projects: profile.projects && profile.projects.length > 0 ? 100 : 0,
      
      // Experience: Check if experiences exist
      experience: profile.experiences && profile.experiences.length > 0 ? 100 : 0,
      
      // Intro Video: Check if introVideo exists
      introVideo: profile.introVideo ? 100 : 0,
    };

    const isComplete = personalInfoComplete && addressComplete && educationComplete;

    return {
      completion: profile.profileScore || 0,
      score: profile.profileScore || 0,
      sections,
      // Required fields check for networking
      isComplete,
      missingFields: {
        personalInfo: !personalInfoComplete,
        address: !addressComplete,
        education: !educationComplete,
      },
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
    
    // Map languageKnown to preferredLanguage (if provided)
    // Also allow preferredLanguage to be set directly
    // Preserve empty strings - don't convert to null
    if (data.languageKnown !== undefined) {
      updateData.preferredLanguage = data.languageKnown === '' ? '' : (data.languageKnown || null);
    } else if (data.preferredLanguage !== undefined) {
      // Allow preferredLanguage to be set directly as well
      updateData.preferredLanguage = data.preferredLanguage === '' ? '' : (data.preferredLanguage || null);
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
          // Only set if not already set by mapping logic above
          if (key !== 'preferredLanguage' || updateData.preferredLanguage === undefined) {
            updateData[key] = value;
          }
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
    // Check all possible field names to ensure experience is captured
    const experiencesToCreate = experience || experiences || data.experience || data.experiences;
    
    // Log experience data for debugging
    if (experiencesToCreate !== undefined) {
      this.logger.log(`🔍 Experience data received in updateStudentProfile`, {
        userId,
        hasExperience: !!experience,
        hasExperiences: !!experiences,
        hasDataExperience: !!data.experience,
        hasDataExperiences: !!data.experiences,
        experienceCount: Array.isArray(experiencesToCreate) ? experiencesToCreate.length : 'not an array',
        experienceType: typeof experiencesToCreate,
      });
    }

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
      // 🔍 Enhanced logging: Log payload being sent
      this.logger.log(`🔍 Experience save - Payload being sent`, {
        userId,
        experienceCount: Array.isArray(experiencesToCreate) ? experiencesToCreate.length : 'not an array',
        experienceType: typeof experiencesToCreate,
        rawPayload: JSON.stringify(experiencesToCreate, null, 2),
      });

      // Validate each experience entry
      if (Array.isArray(experiencesToCreate)) {
        experiencesToCreate.forEach((exp: any, index: number) => {
          // Check for minimum required fields
          const hasTitle = !!(exp.designation || exp.title);
          const hasStartDate = !!(exp.startMonthYear || exp.startDate);
          
          this.logger.log(`🔍 Experience entry ${index + 1} - Required fields validation`, {
            entryIndex: index + 1,
            hasTitle,
            hasStartDate,
            title: exp.designation || exp.title || null,
            startDate: exp.startMonthYear || exp.startDate || null,
            companyName: exp.companyName || exp.company || null,
            designation: exp.designation || null,
            currentlyWorking: exp.currentlyWorking || exp.isCurrent || false,
          });
          
          // Warn if critical fields are missing (but don't fail - use defaults)
          if (!hasTitle) {
            this.logger.warn(`⚠️ Experience entry ${index + 1} missing title/designation, will use default`);
          }
          if (!hasStartDate) {
            this.logger.warn(`⚠️ Experience entry ${index + 1} missing startMonthYear/startDate, will use current date`);
          }
        });
      }

      // Delete existing experiences
      try {
        await this.prisma.experience.deleteMany({
          where: { studentId: updated.id },
        });
        this.logger.log(`✅ Deleted existing experiences for user ${userId}`);
      } catch (deleteError: any) {
        const dbErrorInfo = logErrorWithDatabaseDetection(
          this.logger,
          `Experience delete - Error deleting existing experiences for user ${userId}`,
          deleteError,
          { userId, studentId: updated.id }
        );
        // Continue even if delete fails - might be first time creating experiences
        this.logger.warn(`⚠️ Continuing despite delete error (might be first time creating experiences)`);
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
            
            // Log the data being sent to database
            this.logger.log(`🔍 Experience save - Data being sent to database`, {
              userId,
              recordCount: experienceData.length,
              sampleRecord: experienceData[0] ? {
                title: experienceData[0].title,
                companyName: experienceData[0].companyName,
                startDate: experienceData[0].startDate,
                endDate: experienceData[0].endDate,
                currentlyWorking: experienceData[0].currentlyWorking,
              } : null,
            });
            
            const createResult = await this.prisma.experience.createMany({
              data: experienceData,
              skipDuplicates: true, // Skip duplicates if any
            });
            
            // ✅ Enhanced logging: Log backend response
            this.logger.log(`✅ Experience save - Backend response`, {
              userId,
              recordsCreated: createResult.count,
              expectedCount: experienceData.length,
              success: createResult.count === experienceData.length,
            });
            
            this.logger.log(`✅ Successfully created ${createResult.count} experience records for user ${userId}`);
          } catch (createError: any) {
            // 🔴 Enhanced error logging with database detection
            const dbErrorInfo = logErrorWithDatabaseDetection(
              this.logger,
              `Experience save error - Error creating experiences for user ${userId}`,
              createError,
              {
                userId,
                studentId: updated.id,
                experienceCount: experiencesToCreate.length,
                errorDetails: {
                  message: createError.message,
                  code: createError.code,
                  meta: createError.meta,
                  stack: createError.stack,
                },
              }
            );
            
            // Throw appropriate exception based on error type
            if (dbErrorInfo.isDatabaseError) {
              // Database error - use user-friendly message
              throw new InternalServerErrorException({
                message: dbErrorInfo.userFriendlyMessage,
                error: 'Database Error',
                isDatabaseError: true,
                errorType: dbErrorInfo.errorType,
                errorCode: dbErrorInfo.errorCode,
                detectedKeywords: dbErrorInfo.detectedKeywords,
                originalError: createError.message,
              });
            } else if (dbErrorInfo.errorType === 'validation') {
              // Validation error
              throw new BadRequestException({
                message: dbErrorInfo.userFriendlyMessage,
                error: 'Validation Error',
                isDatabaseError: false,
                errorType: dbErrorInfo.errorType,
                originalError: createError.message,
              });
            } else {
              // Other errors
              throw new BadRequestException({
                message: `Failed to save experiences: ${createError.message}. Please check the data format.`,
                error: 'Save Error',
                isDatabaseError: false,
                errorType: dbErrorInfo.errorType,
                originalError: createError.message,
              });
            }
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
    const updatedProfile = await this.prisma.studentProfile.findUnique({
      where: { id: updated.id },
      include: {
        projects: true,
        experiences: true,
      },
    });

    // Transform response to include compatibility fields for mobile app
    if (updatedProfile) {
      // Map preferredLanguage to languageKnown for compatibility
      (updatedProfile as any).languageKnown = updatedProfile.preferredLanguage || '';
      // Map experiences relation to experience array for compatibility
      (updatedProfile as any).experience = updatedProfile.experiences || [];
    }

    return updatedProfile;
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

  /**
   * Update student experience - replaces entire experience array
   * Required fields: companyName, location, department, designation, startMonthYear, aboutRole
   * endMonthYear is required only when currentlyWorking is false
   * Date format: MM/YYYY (e.g., 01/2020)
   */
  async updateExperience(userId: string, experienceArray: any[]) {
    try {
      this.logger.log(`📝 updateExperience called for user ${userId}`, {
        experienceArrayLength: Array.isArray(experienceArray) ? experienceArray.length : 'not an array',
        experienceArrayType: typeof experienceArray,
        rawData: JSON.stringify(experienceArray, null, 2),
      });

      // Verify user exists and is a student
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { studentProfile: true },
      });

      if (!user) {
        this.logger.warn(`User not found: ${userId}`);
        throw new NotFoundException('User not found');
      }

      if (user.userType !== 'STUDENT') {
        this.logger.warn(`User is not a student: ${userId}, userType: ${user.userType}`);
        throw new BadRequestException('User is not a student');
      }

      if (!user.studentProfile) {
        this.logger.warn(`Student profile not found for user: ${userId}`);
        throw new NotFoundException('Student profile not found');
      }

      // Validate experience array
      if (!Array.isArray(experienceArray)) {
        this.logger.error(`Experience is not an array: ${typeof experienceArray}`);
        throw new BadRequestException('Experience must be an array');
      }

      // Validate each experience entry
      for (let i = 0; i < experienceArray.length; i++) {
        const exp = experienceArray[i];
        
        // Check required fields
        if (!exp.companyName || typeof exp.companyName !== 'string' || exp.companyName.trim() === '') {
          throw new BadRequestException(`Experience entry ${i + 1}: companyName is required`);
        }
        if (!exp.location || typeof exp.location !== 'string' || exp.location.trim() === '') {
          throw new BadRequestException(`Experience entry ${i + 1}: location is required`);
        }
        if (!exp.department || typeof exp.department !== 'string' || exp.department.trim() === '') {
          throw new BadRequestException(`Experience entry ${i + 1}: department is required`);
        }
        if (!exp.designation || typeof exp.designation !== 'string' || exp.designation.trim() === '') {
          throw new BadRequestException(`Experience entry ${i + 1}: designation is required`);
        }
        if (!exp.startMonthYear || typeof exp.startMonthYear !== 'string' || exp.startMonthYear.trim() === '') {
          throw new BadRequestException(`Experience entry ${i + 1}: startMonthYear is required`);
        }
        if (!exp.aboutRole || typeof exp.aboutRole !== 'string' || exp.aboutRole.trim() === '') {
          throw new BadRequestException(`Experience entry ${i + 1}: aboutRole is required`);
        }

        // Validate date format MM/YYYY
        const dateFormatRegex = /^(0[1-9]|1[0-2])\/\d{4}$/;
        if (!dateFormatRegex.test(exp.startMonthYear)) {
          throw new BadRequestException(`Experience entry ${i + 1}: startMonthYear must be in MM/YYYY format (e.g., 01/2020)`);
        }

        // Validate currentlyWorking
        const currentlyWorking = exp.currentlyWorking === true || exp.currentlyWorking === 'true';
        
        // endMonthYear is required only when currentlyWorking is false
        if (!currentlyWorking) {
          // When currentlyWorking is false, endMonthYear is required
          if (!exp.endMonthYear || typeof exp.endMonthYear !== 'string' || exp.endMonthYear.trim() === '') {
            throw new BadRequestException(`Experience entry ${i + 1}: endMonthYear is required when currentlyWorking is false`);
          }
          if (!dateFormatRegex.test(exp.endMonthYear)) {
            throw new BadRequestException(`Experience entry ${i + 1}: endMonthYear must be in MM/YYYY format (e.g., 12/2022)`);
          }
        } else {
          // When currentlyWorking is true, endMonthYear should be empty string or not provided
          // Normalize empty string to null for database storage
          if (exp.endMonthYear === '' || (typeof exp.endMonthYear === 'string' && exp.endMonthYear.trim() === '')) {
            exp.endMonthYear = null;
          } else if (exp.endMonthYear) {
            // If endMonthYear is provided when currentlyWorking is true, that's also valid (user might have ended the role)
            // But validate the format if provided
            if (!dateFormatRegex.test(exp.endMonthYear)) {
              throw new BadRequestException(`Experience entry ${i + 1}: endMonthYear must be in MM/YYYY format (e.g., 12/2022)`);
            }
          }
        }
      }

      // Delete all existing experiences (replace entire array)
      await this.prisma.experience.deleteMany({
        where: { studentId: user.studentProfile.id },
      });

      this.logger.log(`✅ Deleted existing experiences for user ${userId}`);

      // Create new experiences
      if (experienceArray.length > 0) {
        const experienceData = experienceArray.map((exp: any, index: number) => {
          // Parse startMonthYear to startDate (DateTime)
          const startParts = exp.startMonthYear.split('/');
          const startMonth = parseInt(startParts[0], 10);
          const startYear = parseInt(startParts[1], 10);
          const startDate = new Date(startYear, startMonth - 1, 1);

          // Parse endMonthYear to endDate (DateTime) if provided
          let endDate: Date | null = null;
          if (exp.endMonthYear && exp.endMonthYear.trim() !== '') {
            const endParts = exp.endMonthYear.split('/');
            const endMonth = parseInt(endParts[0], 10);
            const endYear = parseInt(endParts[1], 10);
            endDate = new Date(endYear, endMonth - 1, 1);
          }

          const currentlyWorking = exp.currentlyWorking === true || exp.currentlyWorking === 'true';

          return {
            studentId: user.studentProfile.id,
            // Required field: title (use designation)
            title: exp.designation,
            // Required fields from frontend
            companyName: exp.companyName.trim(),
            location: exp.location.trim(),
            department: exp.department.trim(),
            designation: exp.designation.trim(),
            startMonthYear: exp.startMonthYear.trim(),
            endMonthYear: exp.endMonthYear ? exp.endMonthYear.trim() : null,
            aboutRole: exp.aboutRole.trim(),
            // Legacy fields for backward compatibility
            company: exp.companyName.trim(),
            description: exp.aboutRole.trim(),
            // DateTime fields
            startDate,
            endDate,
            // Boolean fields
            currentlyWorking,
            isCurrent: currentlyWorking,
            isFacultyMember: exp.isFacultyMember || false,
          };
        });

        this.logger.log(`💾 Attempting to create ${experienceData.length} experience records for user ${userId}`, {
          sampleRecord: experienceData[0] ? {
            title: experienceData[0].title,
            companyName: experienceData[0].companyName,
            designation: experienceData[0].designation,
            startDate: experienceData[0].startDate,
            endDate: experienceData[0].endDate,
            currentlyWorking: experienceData[0].currentlyWorking,
          } : null,
        });

        try {
          const createResult = await this.prisma.experience.createMany({
            data: experienceData,
          });

          this.logger.log(`✅ Successfully created ${createResult.count} experience records for user ${userId}`, {
            expectedCount: experienceData.length,
            actualCount: createResult.count,
          });

          if (createResult.count !== experienceData.length) {
            this.logger.warn(`⚠️ Mismatch: Expected ${experienceData.length} records, but only ${createResult.count} were created`);
          }
        } catch (dbError: any) {
          this.logger.error(`❌ Database error creating experiences for user ${userId}:`, {
            error: dbError.message,
            code: dbError.code,
            meta: dbError.meta,
            stack: dbError.stack,
          });
          throw new InternalServerErrorException(`Failed to save experiences: ${dbError.message}`);
        }
      } else {
        this.logger.log(`ℹ️ Empty experience array - all experiences removed for user ${userId}`);
      }

      // Recalculate profile score
      await this.calculateProfileScore(userId);

      // Return updated profile with experiences
      return this.prisma.studentProfile.findUnique({
        where: { id: user.studentProfile.id },
        include: {
          experiences: {
            orderBy: {
              startDate: 'desc',
            },
          },
        },
      });
    } catch (error: any) {
      // Re-throw known exceptions
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Error updating experience for user ${userId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to update experience. Please try again.');
    }
  }
}

