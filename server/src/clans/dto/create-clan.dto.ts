import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateClanDto {
    @ApiProperty({
        description: 'Clan name',
        example: 'Code Warriors',
        minLength: 3,
        maxLength: 30,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(30)
    name: string;

    @ApiProperty({
        description: 'Clan tag (2-5 uppercase letters)',
        example: 'CW',
        minLength: 2,
        maxLength: 5,
    })
    @IsString()
    @IsNotEmpty()
    @Matches(/^[A-Z]{2,5}$/, {
        message: 'Tag must be 2-5 uppercase letters',
    })
    tag: string;

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
