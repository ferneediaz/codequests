import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RankTierDto } from '../../common/dto/rank-tier.dto';

export class UserResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'codemaster42' })
  username: string;

  @ApiProperty({ example: 'https://example.com/avatar.png', nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ example: 1250, description: 'Matchmaking Rating' })
  mmr: number;

  @ApiProperty({ example: 15 })
  wins: number;

  @ApiProperty({ example: 8 })
  losses: number;

  @ApiPropertyOptional({ type: RankTierDto, description: 'Rank tier based on MMR' })
  tier?: RankTierDto;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  createdAt: Date;
}
