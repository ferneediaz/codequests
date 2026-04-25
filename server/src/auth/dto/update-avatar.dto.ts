import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUrl } from 'class-validator';
import { AvatarSource } from '@prisma/client';

/**
 * Body for `PATCH /auth/avatar`. The client is expected to have already
 * uploaded the image to Supabase Storage (or any CDN) and pass the public
 * URL here. We only persist the reference.
 */
export class UpdateAvatarDto {
  @ApiProperty({
    description: 'Public URL of the uploaded avatar image',
    example: 'https://xyz.supabase.co/storage/v1/object/public/avatars/user-id/abc.png',
  })
  @IsUrl()
  avatarUrl!: string;

  @ApiPropertyOptional({
    enum: AvatarSource,
    description: 'Origin of the URL. Defaults to URL when the user uploaded it.',
  })
  @IsOptional()
  @IsEnum(AvatarSource)
  avatarSource?: AvatarSource;
}
