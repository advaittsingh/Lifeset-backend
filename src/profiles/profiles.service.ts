import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ProfilesService {
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
      // Format the response to include all saved data
      const formattedUser = {
        ...user,
        studentProfile: user.studentProfile ? {
          ...user.studentProfile,
          // Extract metadata from education12th if it exists
          metadata: user.studentProfile.education12th && typeof user.studentProfile.education12th === 'object' && !Array.isArray(user.studentProfile.education12th)
            ? user.studentProfile.education12th
            : null,
          // Education array is in education10th
          education: Array.isArray(user.studentProfile.education10th) 
            ? user.studentProfile.education10th 
            : null,
          // Map profileImage to profilePicture for frontend compatibility
          profilePicture: user.studentProfile.profileImage,
          // Map preferredLanguage to languageKnown for frontend compatibility
          languageKnown: user.studentProfile.preferredLanguage,
        } : null,
      };
      
      return formattedUser;
    } catch (error: any) {
      // Re-throw known exceptions
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Log and wrap unexpected errors
      console.error('Error fetching user profile:', error);
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
    console.log('📝 updateStudentProfile called with:', {
      userId,
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
      'education10th', 'education12th', 'graduation', 'postGraduation',
      'technicalSkills', 'softSkills'
    ];

    // Extract nested fields and arrays (not direct StudentProfile fields)
    // These will be stored in JSON fields or metadata
    const {
      nativeAddress,
      currentAddress,
      education, // Array of education entries
      competitiveExams, // Array of competitive exam entries
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
      category, // Store in metadata
      religion, // Store in metadata
      fatherName, // Store in metadata
      fatherHighestDegree, // Store in metadata
      fatherOccupation, // Store in metadata
      motherName, // Store in metadata
      motherHighestDegree, // Store in metadata
      motherOccupation, // Store in metadata
      ...profileData
    } = data;

    // Create metadata object to store additional fields not in schema
    const metadata: any = {};

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
      if (['nativeAddress', 'currentAddress', 'education', 'competitiveExams', 'projects', 
           'experience', 'experiences', 'introVideo', 'resume', 'interestHobbies', 
           'professionalSkills', 'internSwitch', 'mentorFor', 'profilePicture', 
           'languageKnown', 'category', 'religion', 'fatherName', 'fatherHighestDegree',
           'fatherOccupation', 'motherName', 'motherHighestDegree', 'motherOccupation'].includes(key)) {
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

    // Handle education fields - support both array format and object format
    // Education array format: [{ level, currentlyStudying, schoolInstituteCollege, ... }, ...]
    if (education !== undefined) {
      if (Array.isArray(education)) {
        // Store education array directly
        updateData.education10th = education;
      } else if (typeof education === 'object' && education !== null) {
        // Support legacy format with separate fields
        if (education.education10th !== undefined) updateData.education10th = education.education10th;
        if (education.education12th !== undefined) updateData.education12th = education.education12th;
        if (education.graduation !== undefined) updateData.graduation = education.graduation;
        if (education.postGraduation !== undefined) updateData.postGraduation = education.postGraduation;
      }
    }
    
    // Also check for direct education fields (legacy support)
    if (data.education10th !== undefined) updateData.education10th = data.education10th;
    if (data.education12th !== undefined) updateData.education12th = data.education12th;
    if (data.graduation !== undefined) updateData.graduation = data.graduation;
    if (data.postGraduation !== undefined) updateData.postGraduation = data.postGraduation;

    // Handle technicalSkills and softSkills (arrays)
    if (data.technicalSkills !== undefined) {
      updateData.technicalSkills = Array.isArray(data.technicalSkills) ? data.technicalSkills : [];
    }
    if (data.softSkills !== undefined) {
      updateData.softSkills = Array.isArray(data.softSkills) ? data.softSkills : [];
    }

    // Store additional fields in metadata (using education10th JSON field as metadata storage)
    // Personal Details - Family Info
    if (data.category !== undefined) metadata.category = data.category;
    if (data.religion !== undefined) metadata.religion = data.religion;
    if (data.fatherName !== undefined) metadata.fatherName = data.fatherName;
    if (data.fatherHighestDegree !== undefined) metadata.fatherHighestDegree = data.fatherHighestDegree;
    if (data.fatherOccupation !== undefined) metadata.fatherOccupation = data.fatherOccupation;
    if (data.motherName !== undefined) metadata.motherName = data.motherName;
    if (data.motherHighestDegree !== undefined) metadata.motherHighestDegree = data.motherHighestDegree;
    if (data.motherOccupation !== undefined) metadata.motherOccupation = data.motherOccupation;

    // Addresses - Store in metadata
    if (nativeAddress !== undefined) metadata.nativeAddress = nativeAddress;
    if (currentAddress !== undefined) metadata.currentAddress = currentAddress;

    // Education Array - Store in education10th JSON field (or create new JSON field)
    // For now, store in education10th as an array
    if (education !== undefined && Array.isArray(education)) {
      // Store education array in education10th field (we'll use this as general education storage)
      updateData.education10th = education;
    }

    // Competitive Exams - Store in metadata
    if (competitiveExams !== undefined && Array.isArray(competitiveExams)) {
      metadata.competitiveExams = competitiveExams;
    }

    // Skills - Store arrays in metadata
    if (interestHobbies !== undefined && Array.isArray(interestHobbies)) {
      metadata.interestHobbies = interestHobbies;
    }
    if (professionalSkills !== undefined && Array.isArray(professionalSkills)) {
      metadata.professionalSkills = professionalSkills;
    }
    if (internSwitch !== undefined) metadata.internSwitch = internSwitch;
    if (mentorFor !== undefined) metadata.mentorFor = mentorFor;

    // Intro Video and Resume - Store in metadata
    if (introVideo !== undefined) metadata.introVideo = introVideo;
    if (resume !== undefined) metadata.resume = resume;

    // Store all metadata in education12th JSON field
    // education10th is used for education array, education12th for metadata
    if (Object.keys(metadata).length > 0) {
      // If education12th already exists, merge metadata
      if (updateData.education12th && typeof updateData.education12th === 'object' && !Array.isArray(updateData.education12th)) {
        updateData.education12th = { ...updateData.education12th, ...metadata };
      } else {
        updateData.education12th = metadata;
      }
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
    console.log('💾 Saving profile with fields:', {
      updateFields: Object.keys(updateFields),
      hasProjects: !!projectsToCreate,
      hasExperiences: !!experiencesToCreate,
    });

    const updated = await this.prisma.studentProfile.upsert({
      where: { userId },
      update: updateFields, // Only update provided fields
      create: createFields,
    });

    console.log('✅ Profile saved successfully:', {
      profileId: updated.id,
      fieldsUpdated: Object.keys(updateFields).length,
      hasEducation: !!updateData.education10th,
      hasMetadata: !!updateData.education12th,
      projectsCount: projectsToCreate?.length || 0,
      experiencesCount: experiencesToCreate?.length || 0,
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
          data: projectsToCreate.map((project: any) => {
            // Parse startMonthYear and endMonthYear to dates if provided
            let startDate = new Date();
            let endDate: Date | null = null;
            
            if (project.startMonthYear) {
              const [month, year] = project.startMonthYear.split('/');
              startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            }
            
            if (project.endMonthYear) {
              const [month, year] = project.endMonthYear.split('/');
              endDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            }

            return {
              studentId: updated.id,
              title: project.projectName || project.title || 'Untitled Project',
              description: project.aboutProject || project.description || '',
              images: project.images || [],
              links: project.links || [],
              technologies: project.technologies || [],
              // Store additional fields in a JSON field if needed (using images array for now)
              // For now, store location, department, designation in description or as JSON
            };
          }),
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

            // Build description with all fields
            const descriptionParts = [];
            if (exp.aboutRole) descriptionParts.push(exp.aboutRole);
            if (exp.location) descriptionParts.push(`Location: ${exp.location}`);
            if (exp.department) descriptionParts.push(`Department: ${exp.department}`);
            if (exp.isFacultyMember) descriptionParts.push('Faculty Member');
            const fullDescription = descriptionParts.join('\n') || exp.description || null;

            return {
              studentId: updated.id,
              title: exp.designation || exp.title || 'Untitled',
              company: exp.companyName || exp.company || null,
              description: fullDescription,
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

