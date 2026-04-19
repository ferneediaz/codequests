import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BattleMode, BattleStatus, SkillType } from '@prisma/client';
import { RankTierDto } from '../../common/dto/rank-tier.dto';

export class ParticipantUserDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    username: string;

    @ApiPropertyOptional()
    avatarUrl?: string;

    @ApiPropertyOptional()
    mmr?: number;

    @ApiPropertyOptional({ type: RankTierDto, description: 'Rank tier based on MMR' })
    tier?: RankTierDto;
}

export class BattleParticipantResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    userId: string;

    @ApiProperty()
    username: string;

    @ApiPropertyOptional({ description: 'Team ID for team battles' })
    teamId?: string;

    @ApiPropertyOptional()
    code?: string;

    @ApiPropertyOptional()
    language?: string;

    @ApiProperty()
    testsPassed: number;

    @ApiProperty()
    totalTests: number;

    @ApiProperty({ description: 'Points earned in team battles' })
    pointsEarned: number;

    @ApiProperty({ description: 'Whether the player is ready (invite battles)' })
    isReady: boolean;

    @ApiPropertyOptional()
    submittedAt?: Date;

    @ApiPropertyOptional()
    mmrChange?: number;
}

export class ProblemPoolItemDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    problemId: string;

    @ApiProperty()
    title: string;

    @ApiProperty({ enum: ['EASY', 'MEDIUM', 'HARD'] })
    difficulty: string;

    @ApiProperty({ description: 'Point value (Easy=2, Medium=5, Hard=10)' })
    pointValue: number;
}

export class TeamScoreDto {
    @ApiProperty({ description: 'Team identifier (team-1 or team-2)' })
    teamId: string;

    @ApiProperty({ description: 'Total points earned by team' })
    totalPoints: number;

    @ApiProperty({ type: [BattleParticipantResponseDto] })
    members: BattleParticipantResponseDto[];
}

export class SkillUseResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    userId: string;

    @ApiProperty()
    targetUserId: string;

    @ApiProperty({ enum: SkillType })
    skillType: SkillType;

    @ApiProperty()
    usedAt: Date;
}

export class BattleResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ enum: BattleMode })
    mode: BattleMode;

    @ApiPropertyOptional({ description: 'Problem ID (for single-problem battles)' })
    problemId?: string;

    @ApiPropertyOptional({ description: 'Team size for team battles' })
    teamSize?: number;

    @ApiProperty({ description: 'Time limit in minutes' })
    timeLimitMinutes: number;

    @ApiProperty({ description: 'Auto-balance teams by MMR' })
    autoBalance: boolean;

    @ApiPropertyOptional({ description: 'Winner user ID (for individual battles)' })
    winnerId?: string;

    @ApiPropertyOptional({ description: 'Winning team ID (for team battles)' })
    winningTeam?: string;

    @ApiProperty({ enum: BattleStatus })
    status: BattleStatus;

    @ApiPropertyOptional()
    startedAt?: Date;

    @ApiPropertyOptional()
    endedAt?: Date;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty({ type: [BattleParticipantResponseDto] })
    participants: BattleParticipantResponseDto[];

    @ApiPropertyOptional({ type: [ProblemPoolItemDto], description: 'Problem pool for team battles' })
    problemPool?: ProblemPoolItemDto[];

    @ApiPropertyOptional({ type: [TeamScoreDto], description: 'Team scores (for team battles)' })
    teams?: TeamScoreDto[];

    @ApiPropertyOptional({ enum: SkillType, isArray: true, description: 'Skills enabled for this battle' })
    enabledSkills?: SkillType[];

    @ApiPropertyOptional({ description: 'Invite code for direct invite battles' })
    inviteCode?: string;

    @ApiPropertyOptional({ description: 'When the invite code expires' })
    inviteExpiresAt?: Date;

    @ApiPropertyOptional({ type: [SkillUseResponseDto], description: 'Skills used during this battle' })
    skillUses?: SkillUseResponseDto[];
}

export class BattleHistoryResponseDto {
    @ApiProperty({ type: [BattleResponseDto] })
    data: BattleResponseDto[];

    @ApiProperty({
        example: { total: 10, page: 1, limit: 20, totalPages: 1 },
    })
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}
