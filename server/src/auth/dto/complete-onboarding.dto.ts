import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsUrl,
  IsEnum,
} from 'class-validator';
import {
  UserSegment,
  CodingExperience,
  PrimaryGoal,
  HowHeard,
  AvatarSource,
} from '@prisma/client';

export class CompleteOnboardingDto {
  @ApiProperty({ example: 'codemaster42' })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username!: string;

  @ApiProperty({ enum: UserSegment, example: UserSegment.PROFESSIONAL })
  @IsEnum(UserSegment)
  userSegment!: UserSegment;

  @ApiPropertyOptional({ description: 'Profile image URL (e.g. GitHub or uploaded asset URL)' })
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({ enum: CodingExperience })
  @IsEnum(CodingExperience)
  @IsOptional()
  codingExperience?: CodingExperience;

  @ApiPropertyOptional({ enum: PrimaryGoal })
  @IsEnum(PrimaryGoal)
  @IsOptional()
  primaryGoal?: PrimaryGoal;

  @ApiPropertyOptional({ enum: HowHeard })
  @IsEnum(HowHeard)
  @IsOptional()
  howHeard?: HowHeard;

  @ApiPropertyOptional({ enum: AvatarSource, description: 'How the avatar URL was chosen' })
  @IsEnum(AvatarSource)
  @IsOptional()
  avatarSource?: AvatarSource;
}
