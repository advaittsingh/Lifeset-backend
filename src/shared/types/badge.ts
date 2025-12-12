export enum BadgeTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

export interface BadgeCriteria {
  score?: number;
  streak?: number;
  engagement?: {
    connections?: number;
    posts?: number;
    mcqAttempts?: number;
  };
}

export interface CreateBadgeDto {
  name: string;
  description: string;
  tier: BadgeTier;
  icon: string;
  criteria: BadgeCriteria;
}

