import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { BattleMode } from '@prisma/client';

export class CreateBattleDto {
    @ApiProperty({
        description: 'ID of the problem for this battle',
        example: 'problem-uuid-123',
    })
    @IsString()
    @IsNotEmpty()
    problemId: string;

    @ApiProperty({
        description: 'Battle mode',
        enum: BattleMode,
        default: BattleMode.ONE_V_ONE,
    })
    @IsEnum(BattleMode)
    @IsOptional()
    mode?: BattleMode;
}
