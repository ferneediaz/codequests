import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';

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
}
