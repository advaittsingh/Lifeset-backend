/**
 * Maps notification type to data.type format for mobile app filtering
 * Mobile app expects data.type to be lowercase with hyphens (e.g., "current-affair", "mcq", "admin")
 */
export function mapNotificationTypeToDataType(notificationType: string): string {
  const type = notificationType.toUpperCase();
  
  // Map NotificationType enum values to data.type strings
  if (type === 'CURRENT_AFFAIR' || type === 'CA' || type === 'ARTICLE' || type === 'CONTENT') {
    return 'current-affair';
  } else if (type === 'GENERAL_KNOWLEDGE' || type === 'GK') {
    return 'general-knowledge';
  } else if (type === 'GOVT_VACANCY' || type === 'VACANCY') {
    return 'govt-vacancy';
  } else if (type === 'DAILY_DIGEST') {
    return 'daily-digest';
  } else if (type === 'KNOW_YOURSELF') {
    return 'know-yourself';
  } else if (type === 'MCQ') {
    return 'mcq';
  } else if (type === 'EXAM') {
    return 'exam';
  } else if (type === 'JOB') {
    return 'job';
  } else if (type === 'ADMIN' || type === 'CMS' || type === 'SYSTEM') {
    return 'admin';
  } else if (type === 'EVENT' || type === 'COLLEGE_EVENT') {
    return 'event';
  } else if (type === 'ANNOUNCEMENT' || type === 'UPDATE') {
    return 'announcement';
  }
  
  // Default: use lowercase version of the type
  return notificationType.toLowerCase();
}

/**
 * Maps frontend type names (lowercase, hyphenated) to database NotificationType enum values
 * Handles frontend types like "current-affairs", "ca", "gk", "general-knowledge", etc.
 * Returns the corresponding database enum value or null if no match
 */
export function mapFrontendTypeToDatabaseType(frontendType: string): string | null {
  if (!frontendType) {
    return null;
  }

  const normalized = frontendType.toLowerCase().trim();
  
  // Map frontend type names to database enum values
  switch (normalized) {
    // Current Affairs
    case 'current-affairs':
    case 'current-affair':
    case 'ca':
      return 'CURRENT_AFFAIRS';
    
    // General Knowledge
    case 'general-knowledge':
    case 'gk':
      return 'GENERAL_KNOWLEDGE';
    
    // Admin/CMS
    case 'admin':
    case 'cms':
      return 'ADMIN';
    
    // MCQ
    case 'mcq':
      return 'MCQ';
    
    // Exam
    case 'exam':
      return 'EXAM';
    
    // Job
    case 'job':
      return 'JOB';
    
    // Govt Vacancy
    case 'govt-vacancy':
    case 'vacancy':
      return 'GOVT_VACANCY';
    
    // Daily Digest
    case 'daily-digest':
    case 'digest':
      return 'DAILY_DIGEST';
    
    // Know Yourself
    case 'know-yourself':
    case 'personality':
      return 'KNOW_YOURSELF';
    
    // System (maps to SYSTEM or ADMIN)
    case 'system':
      return 'SYSTEM';
    
    // Chat
    case 'chat':
      return 'CHAT';
    
    // Connection
    case 'connection':
    case 'network':
      return 'CONNECTION';
    
    // If already in database format (uppercase with underscores), return as-is
    default:
      // Check if it's already a valid database format (uppercase with underscores or all uppercase)
      const upperCase = normalized.toUpperCase();
      if (upperCase.includes('_') || ['JOB', 'CHAT', 'EXAM', 'SYSTEM', 'CONNECTION', 'ADMIN', 
                                      'CURRENT_AFFAIRS', 'GENERAL_KNOWLEDGE', 'MCQ', 
                                      'GOVT_VACANCY', 'DAILY_DIGEST', 'KNOW_YOURSELF'].includes(upperCase)) {
        return upperCase;
      }
      return null;
  }
}
