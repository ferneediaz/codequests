import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClanChallengeStatus, SkillType } from '@prisma/client';

export class ChallengeClanDto {
    @ApiProperty({ description: 'Clan ID' })
    id: string;

    @ApiProperty({ description: 'Clan name' })
    name: string;

    @ApiProperty({ description: 'Clan tag' })
    tag: string;

    @ApiProperty({ description: 'Clan MMR' })
    mmr: number;
}

export class ChallengeResponseDto {
    @ApiProperty({ description: 'Challenge ID' })
    id: string;

    @ApiProperty({ description: 'Challenge status', enum: ClanChallengeStatus })
    status: ClanChallengeStatus;

    @ApiProperty({ description: 'Challenger clan', type: ChallengeClanDto })
    challengerClan: ChallengeClanDto;

    @ApiProperty({ description: 'Challenged clan', type: ChallengeClanDto })
    challengedClan: ChallengeClanDto;

    @ApiPropertyOptional({ description: 'Challenge message' })
    message?: string;

    @ApiProperty({ description: 'Proposed team size' })
    teamSize: number;

    @ApiProperty({ description: 'Proposed time limit in minutes' })
    timeLimitMinutes: number;

    @ApiProperty({ description: 'Proposed enabled skills', enum: SkillType, isArray: true })
    enabledSkills: SkillType[];

    @ApiPropertyOptional({ description: 'Preferred topic' })
    preferredTopic?: string;

    @ApiPropertyOptional({ description: 'Counter-proposed team size' })
    counterTeamSize?: number;

    @ApiPropertyOptional({ description: 'Counter-proposed time limit' })
    counterTimeLimitMinutes?: number;

    @ApiPropertyOptional({ description: 'Counter-proposed skills', enum: SkillType, isArray: true })
    counterEnabledSkills?: SkillType[];

    @ApiPropertyOptional({ description: 'Counter-proposed topic' })
    counterPreferredTopic?: string;

    @ApiPropertyOptional({ description: 'Counter-proposal message' })
    counterMessage?: string;

    @ApiProperty({ description: 'Challenge expiration time' })
    expiresAt: Date;

    @ApiPropertyOptional({ description: 'When the challenge was responded to' })
    respondedAt?: Date;

    @ApiProperty({ description: 'When the challenge was created' })
    createdAt: Date;
}
