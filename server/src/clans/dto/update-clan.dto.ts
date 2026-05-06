import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsString, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

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

    @ApiPropertyOptional({ description: 'Clan banner image URL' })
    @IsString()
    @IsOptional()
    @MaxLength(500)
    bannerUrl?: string;

    @ApiPropertyOptional({ description: 'Clan logo image URL' })
    @IsString()
    @IsOptional()
    @MaxLength(500)
    logoUrl?: string;

    @ApiPropertyOptional({ description: 'Whether join requests require owner approval' })
    @IsBoolean()
    @IsOptional()
    inviteOnly?: boolean;
}
