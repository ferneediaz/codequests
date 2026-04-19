import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RankTierDto {
  @ApiProperty({ example: 'Stack Overflow Andy', description: 'Rank name' })
  name: string;

  @ApiProperty({ example: '🔍', description: 'Rank icon emoji' })
  icon: string;

  @ApiProperty({ example: '#c0c0c0', description: 'Rank color hex code' })
  color: string;

  @ApiProperty({ example: 1200, description: 'Minimum MMR for this tier' })
  minMmr: number;

  @ApiPropertyOptional({ example: 1399, description: 'Maximum MMR for this tier (null for top tier)', nullable: true })
  maxMmr: number | null;
}
