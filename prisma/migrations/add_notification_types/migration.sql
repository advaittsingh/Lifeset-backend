-- Migration: Add new notification types to NotificationType enum
-- This migration adds support for filtering notifications by type from the frontend
-- Frontend types: admin, current-affairs, ca, gk, general-knowledge, mcq, exam, job, govt-vacancy, daily-digest, know-yourself

-- Add new enum values to NotificationType enum
-- Note: ALTER TYPE ADD VALUE cannot be used inside a transaction block,
-- so we use separate DO blocks for each value with error handling

DO $$ BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'ADMIN';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'CURRENT_AFFAIRS';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'GENERAL_KNOWLEDGE';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'MCQ';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'GOVT_VACANCY';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'DAILY_DIGEST';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'KNOW_YOURSELF';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
