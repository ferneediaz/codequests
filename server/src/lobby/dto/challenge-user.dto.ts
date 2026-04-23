import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';

export class ChallengeUserDto {
    @ApiProperty({ description: 'User ID of the player to challenge to a 1v1 battle' })
    @IsString()
    @IsNotEmpty()
    targetUserId!: string;

    @ApiPropertyOptional({
        description:
            'Optional battle time limit in minutes. Defaults to 5.',
        minimum: 1,
        maximum: 60,
        default: 5,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(60)
    timeLimitMinutes?: number;
}
