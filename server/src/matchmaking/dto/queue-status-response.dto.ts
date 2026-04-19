import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BattleMode, Difficulty, MatchmakingStatus } from '@prisma/client';

export class QueueStatusResponseDto {
    @ApiProperty({ description: 'Whether the user is currently in queue' })
    inQueue: boolean;

    @ApiPropertyOptional({ description: 'Queue entry ID' })
    id?: string;

    @ApiPropertyOptional({ description: 'Battle mode queued for', enum: BattleMode })
    mode?: BattleMode;

    @ApiPropertyOptional({ description: 'Preferred difficulty', enum: Difficulty })
    preferredDifficulty?: Difficulty | null;

    @ApiPropertyOptional({ description: 'Queue status', enum: MatchmakingStatus })
    status?: MatchmakingStatus;

    @ApiPropertyOptional({ description: 'When the user joined the queue' })
    queuedAt?: Date;

    @ApiPropertyOptional({ description: 'Battle ID if matched' })
    battleId?: string;
}
