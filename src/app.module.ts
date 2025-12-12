import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProfilesModule } from './profiles/profiles.module';
import { FeedsModule } from './feeds/feeds.module';
import { CmsModule } from './cms/cms.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdsModule } from './ads/ads.module';
import { ReferralModule } from './referral/referral.module';
import { PerformanceModule } from './performance/performance.module';
import { QueueModule } from './queue/queue.module';
import { ChatModule } from './chat/chat.module';
import { JobsModule } from './jobs/jobs.module';
import { ProjectsModule } from './projects/projects.module';
import { ExamsModule } from './exams/exams.module';
import { McqModule } from './mcq/mcq.module';
import { PersonalityModule } from './personality/personality.module';
import { CommunityModule } from './community/community.module';
import { MentorsModule } from './mentors/mentors.module';
import { InstitutesModule } from './institutes/institutes.module';
import { RecruiterModule } from './recruiter/recruiter.module';
import { FileModule } from './file/file.module';
import { AdminModule } from './admin/admin.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // In production/Vercel, env vars come from process.env, .env file is for local dev
      envFilePath: process.env.NODE_ENV === 'production' ? undefined : '.env',
      // Allow environment variables from process.env (Vercel provides these)
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    PrismaModule,
    RedisModule,
    QueueModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
    FeedsModule,
    CmsModule,
    AnalyticsModule,
    NotificationsModule,
    AdsModule,
    ReferralModule,
    PerformanceModule,
    ChatModule,
    JobsModule,
    ProjectsModule,
    ExamsModule,
    McqModule,
    PersonalityModule,
    CommunityModule,
    MentorsModule,
    InstitutesModule,
    RecruiterModule,
    FileModule,
    AdminModule,
    MonitoringModule,
  ],
})
export class AppModule {}

