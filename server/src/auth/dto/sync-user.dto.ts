import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength, Matches, IsUrl } from 'class-validator';

export class SyncUserDto {
  @ApiProperty({
    description: 'Username for the user',
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

  /**
   * OAuth provider avatar URL (e.g. `session.user.user_metadata.avatar_url`
   * from Supabase GitHub/Google). Persisted as the initial avatar so new
   * users land in the app with their provider picture already set.
   */
  @ApiPropertyOptional({ description: 'OAuth provider avatar URL' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  /**
   * GitHub username (`session.user.user_metadata.user_name`) when the
   * Supabase provider is GitHub. Used so the server can render another
   * user's contribution heatmap on their public profile.
   */
  @ApiPropertyOptional({ description: 'GitHub login (only for GitHub OAuth)' })
  @IsOptional()
  @IsString()
  @MaxLength(39) // GitHub usernames cap at 39 chars
  githubUsername?: string;
}
