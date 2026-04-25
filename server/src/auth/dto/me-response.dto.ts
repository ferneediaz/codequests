import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  SubscriptionTier,
  UserSegment,
  CodingExperience,
  PrimaryGoal,
  HowHeard,
  AvatarSource,
  User,
  Clan,
} from '@prisma/client';

class ClanRefDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  tag: string;
}

/**
 * Response for GET /auth/me: full `User` row, `clan` include, and `needsOnboarding`.
 * Additional scalars (subscription, usage caps) are included from Prisma; see `User` in schema.
 */
export class MeResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  email: string;
  @ApiProperty()
  username: string;
  @ApiProperty({ nullable: true })
  avatarUrl: string | null;
  @ApiProperty()
  role: string;
  @ApiProperty({ description: 'True until POST /auth/onboarding completes' })
  needsOnboarding: boolean;
  @ApiProperty({ nullable: true, type: 'string', format: 'date-time' })
  onboardingCompletedAt: Date | null;
  @ApiPropertyOptional({ enum: UserSegment, nullable: true })
  userSegment: UserSegment | null;
  @ApiPropertyOptional({ enum: CodingExperience, nullable: true })
  codingExperience: CodingExperience | null;
  @ApiPropertyOptional({ enum: PrimaryGoal, nullable: true })
  primaryGoal: PrimaryGoal | null;
  @ApiPropertyOptional({ enum: HowHeard, nullable: true })
  howHeard: HowHeard | null;
  @ApiPropertyOptional({ enum: AvatarSource, nullable: true })
  avatarSource: AvatarSource | null;
  @ApiProperty()
  mmr: number;
  @ApiProperty()
  wins: number;
  @ApiProperty()
  losses: number;
  @ApiProperty({ enum: SubscriptionTier })
  subscriptionTier: SubscriptionTier;
  @ApiProperty({ nullable: true })
  stripeCustomerId: string | null;
  @ApiProperty()
  gamesPlayedToday: number;
  @ApiProperty()
  lastGameResetAt: Date;
  @ApiProperty({ nullable: true })
  trialEndsAt: Date | null;
  @ApiProperty()
  hasUsedTrial: boolean;
  @ApiProperty({ nullable: true })
  clanId: string | null;
  @ApiPropertyOptional()
  @Type(() => ClanRefDto)
  clan: ClanRefDto | null;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
}

/** Runtime shape of GET/POST profile responses: Prisma `User` + `clan` + gate */
export type MeUser = User & { clan: Clan | null } & { needsOnboarding: boolean };
