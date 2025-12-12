export enum FeedType {
  COLLEGE_FEED = 'COLLEGE_FEED',
  JOB = 'JOB',
  INTERNSHIP = 'INTERNSHIP',
  GOVT_JOB = 'GOVT_JOB',
  CURRENT_AFFAIRS = 'CURRENT_AFFAIRS',
  EVENT = 'EVENT',
  FREELANCING = 'FREELANCING',
  DIGEST = 'DIGEST',
}

export interface CreateFeedDto {
  title: string;
  description: string;
  postType: FeedType;
  categoryId?: string;
  images?: string[];
  metadata?: any;
}

export interface UpdateFeedDto {
  title?: string;
  description?: string;
  categoryId?: string;
  images?: string[];
  metadata?: any;
  isActive?: boolean;
}

export interface FeedFilterDto {
  type?: FeedType;
  search?: string;
  category?: string;
  tags?: string[];
  college?: string;
  recency?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface FeedInteractionDto {
  feedId: string;
  userId: string;
}

