import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength, Matches, IsUrl } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    description: 'New username',
    example: 'codemaster42',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username?: string;

  @ApiProperty({
    description: 'Avatar URL',
    example: 'https://example.com/avatar.png',
    required: false,
  })
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;
}
