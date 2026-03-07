import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdateClanDto {
    @ApiPropertyOptional({
        description: 'Clan name',
        example: 'Code Warriors Elite',
        minLength: 3,
        maxLength: 30,
    })
    @IsString()
    @IsOptional()
    @MinLength(3)
    @MaxLength(30)
    name?: string;

    @ApiPropertyOptional({
        description: 'Clan tag (2-5 uppercase letters)',
        example: 'CWE',
        minLength: 2,
        maxLength: 5,
    })
    @IsString()
    @IsOptional()
    @Matches(/^[A-Z]{2,5}$/, {
        message: 'Tag must be 2-5 uppercase letters',
    })
    tag?: string;
}
