import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { BattleMode, Difficulty } from '@prisma/client';

export class JoinQueueDto {
    @ApiPropertyOptional({
        description: 'Battle mode to queue for',
        enum: BattleMode,
        default: BattleMode.ONE_V_ONE,
    })
    @IsEnum(BattleMode)
    @IsOptional()
    mode?: BattleMode;

    @ApiPropertyOptional({
        description: 'Preferred problem difficulty',
        enum: Difficulty,
    })
    @IsEnum(Difficulty)
    @IsOptional()
    preferredDifficulty?: Difficulty;
}
