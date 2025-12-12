export enum EventType {
  LOGIN = 'LOGIN',
  FEED_OPEN = 'FEED_OPEN',
  FEED_LIKE = 'FEED_LIKE',
  FEED_SAVE = 'FEED_SAVE',
  FEED_APPLY = 'FEED_APPLY',
  MCQ_ATTEMPT = 'MCQ_ATTEMPT',
  COMMUNITY_ACTION = 'COMMUNITY_ACTION',
  PROFILE_VIEW = 'PROFILE_VIEW',
  CONNECTION_REQUEST = 'CONNECTION_REQUEST',
}

export interface TrackEventDto {
  eventType: EventType;
  entityType?: string;
  entityId?: string;
  metadata?: any;
}

export interface EventAnalyticsDto {
  userId?: string;
  eventType?: EventType;
  startDate?: Date;
  endDate?: Date;
  groupBy?: 'day' | 'week' | 'month';
}

