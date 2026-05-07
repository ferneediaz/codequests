import { ApiProperty } from '@nestjs/swagger';

export class GithubActivityResponseDto {
  @ApiProperty({
    nullable: true,
    description:
      'GitHub login the activity is for. `null` when the user has no github_username on file.',
  })
  username: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { '2026-04-12': 3, '2026-04-13': 5 },
    description:
      'Map of YYYY-MM-DD → push event commit count, derived from the GitHub public events API. Empty when no GH login is stored.',
  })
  commitsByDate: Record<string, number>;
}
