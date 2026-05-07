import { ApiProperty } from '@nestjs/swagger';
import { Difficulty } from '@prisma/client';

export class ContributionResponseDto {
  @ApiProperty({ example: 'cln-7f3a-1' })
  id: string;

  @ApiProperty({ example: 'Two Sum' })
  title: string;

  @ApiProperty({ enum: Difficulty })
  difficulty: Difficulty;

  @ApiProperty({ type: [String], example: ['arrays', 'hash-map'] })
  tags: string[];

  @ApiProperty()
  createdAt: Date;
}
