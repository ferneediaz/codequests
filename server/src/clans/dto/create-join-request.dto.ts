import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateJoinRequestDto {
    @ApiPropertyOptional({ description: 'Optional message to the clan owner' })
    @IsString()
    @IsOptional()
    @MaxLength(500)
    message?: string;
}
