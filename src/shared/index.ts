// Re-export all types from type files
export * from './types/user';
export * from './types/feed';
export * from './types/event';
export * from './types/badge';

// Common Interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Connection Status
export enum ConnectionStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  BLOCKED = 'BLOCKED',
}

// Notification Types
export enum NotificationType {
  JOB = 'JOB',
  CHAT = 'CHAT',
  EXAM = 'EXAM',
  SYSTEM = 'SYSTEM',
  CONNECTION = 'CONNECTION',
}

// User Interfaces
export interface User {
  id: string;
  email?: string;
  mobile?: string;
  userType: import('./types/user').UserType;
  isActive: boolean;
  isVerified: boolean;
  profileImage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  profileImage?: string;
  voiceRecording?: string;
  profileScore: number;
  collegeId?: string;
  courseId?: string;
  education10th?: any;
  education12th?: any;
  graduation?: any;
  postGraduation?: any;
  technicalSkills: string[];
  softSkills: string[];
}

// Feed Interfaces
export interface Feed {
  id: string;
  userId: string;
  title: string;
  description: string;
  postType: import('./types/feed').FeedType;
  categoryId?: string;
  images: string[];
  isActive: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

// Event Interfaces
export interface UserEvent {
  id: string;
  userId: string;
  eventType: import('./types/event').EventType;
  entityType?: string;
  entityId?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// Badge Interfaces
export interface Badge {
  id: string;
  name: string;
  description: string;
  tier: import('./types/badge').BadgeTier;
  icon: string;
  criteria: any;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: Date;
  progress?: number;
}

// Connection Interfaces
export interface Connection {
  id: string;
  requesterId: string;
  receiverId: string;
  status: ConnectionStatus;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Notification Interfaces
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

