import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RankingsClanRefDto {
  @ApiProperty() tag!: string;
  @ApiProperty() name!: string;
}

export class RankingsTierDto {
  @ApiProperty() name!: string;
  @ApiProperty() icon!: string;
  @ApiProperty() color!: string;
  @ApiProperty() minMmr!: number;
  @ApiProperty({ nullable: true, type: Number }) maxMmr!: number | null;
}

export class UserRankingRowDto {
  @ApiProperty({ description: '1-based leaderboard position, offset-aware.' })
  rank!: number;

  @ApiProperty() id!: string;
  @ApiProperty() username!: string;
  @ApiPropertyOptional({ nullable: true }) avatarUrl?: string | null;

  @ApiProperty({ description: 'Current MMR snapshot (not period-relative).' })
  mmr!: number;

  @ApiProperty({ type: RankingsTierDto, description: 'Tier from current MMR.' })
  tier!: RankingsTierDto;

  @ApiPropertyOptional({ type: RankingsClanRefDto, nullable: true })
  clan?: RankingsClanRefDto | null;

  @ApiProperty({
    description:
      "Sum of mmrChange across the user's completed battles in the requested window. Always 0 when period=alltime. GROUP and CLAN_VS_CLAN modes record mmrChange=0 server-side, so they do not contribute.",
  })
  mmrGained!: number;

  @ApiProperty() winsInPeriod!: number;
  @ApiProperty() lossesInPeriod!: number;
  @ApiProperty() gamesPlayed!: number;

  @ApiPropertyOptional({
    description:
      'Wins where BattleParticipant.language matches the language filter (case-insensitive). Present only when ?language= is set.',
  })
  winsInLanguage?: number;
}

export class ClanRankingRowDto {
  @ApiProperty() rank!: number;
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() tag!: string;
  @ApiProperty() mmr!: number;
  @ApiProperty({ type: RankingsTierDto }) tier!: RankingsTierDto;
  @ApiProperty() memberCount!: number;
  @ApiProperty() winsInPeriod!: number;
  @ApiProperty() lossesInPeriod!: number;
}
