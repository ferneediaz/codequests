import { ApiProperty } from '@nestjs/swagger';
import { BattleMode, BattleStatus } from '@prisma/client';

export class BattleParticipantResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    oderId: string;

    @ApiProperty()
    username: string;

    @ApiProperty({ required: false })
    code?: string;

    @ApiProperty({ required: false })
    language?: string;

    @ApiProperty()
    testsPassed: number;

    @ApiProperty()
    totalTests: number;

    @ApiProperty({ required: false })
    submittedAt?: Date;

    @ApiProperty({ required: false })
    mmrChange?: number;
}

export class BattleResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ enum: BattleMode })
    mode: BattleMode;

    @ApiProperty()
    problemId: string;

    @ApiProperty({ required: false })
    winnerId?: string;

    @ApiProperty({ enum: BattleStatus })
    status: BattleStatus;

    @ApiProperty({ required: false })
    startedAt?: Date;

    @ApiProperty({ required: false })
    endedAt?: Date;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty({ type: [BattleParticipantResponseDto] })
    participants: BattleParticipantResponseDto[];
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
