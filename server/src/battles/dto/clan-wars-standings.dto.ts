import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * One member of a Clan Wars team in standings.
 */
export class ClanWarsTeamMemberDto {
    @ApiProperty()
    userId!: string;

    @ApiPropertyOptional()
    username?: string;

    @ApiPropertyOptional()
    avatarUrl?: string | null;

    @ApiPropertyOptional()
    mmr?: number;

    @ApiProperty({
        description: 'Cumulative points earned by this member across all rounds.',
    })
    cumulativePoints!: number;

    @ApiProperty({
        description: 'Points earned by this member in the current round.',
    })
    roundPoints!: number;

    @ApiProperty()
    testsPassed!: number;

    @ApiProperty()
    totalTests!: number;

    @ApiProperty({ description: 'Whether the member has readied up for the next round (intermission).' })
    isReady!: boolean;

    @ApiPropertyOptional({ type: String, format: 'date-time' })
    lastSubmittedAt?: Date | null;
}

/**
 * Aggregated standings for one of the two Clan Wars teams.
 */
export class ClanWarsTeamStandingsDto {
    @ApiProperty({ example: 'team-1' })
    team!: 'team-1' | 'team-2';

    @ApiPropertyOptional({
        description: 'Official clan ID backing this team, if any. Null for temporary clans.',
    })
    clanId?: string | null;

    @ApiProperty({ example: 'Team Rocket' })
    name!: string;

    @ApiPropertyOptional({ example: 'RCKT' })
    tag?: string | null;

    @ApiPropertyOptional({
        description: 'User ID of the team captain (creator for team-1, first-joiner for team-2).',
    })
    captainId?: string | null;

    @ApiProperty({
        description: 'Sum of member cumulativePoints across all rounds.',
    })
    cumulativePoints!: number;

    @ApiProperty({
        description: 'Sum of member points for the current round.',
    })
    roundPoints!: number;

    @ApiProperty({
        description: 'Count of rounds this team has won so far (tie-breaker).',
    })
    roundsWon!: number;

    @ApiProperty()
    testsPassed!: number;

    @ApiProperty()
    totalTests!: number;

    @ApiPropertyOptional({ type: String, format: 'date-time' })
    lastSubmittedAt?: Date | null;

    @ApiProperty({ type: [ClanWarsTeamMemberDto] })
    members!: ClanWarsTeamMemberDto[];
}

export class ClanWarsStandingsResponseDto {
    @ApiProperty()
    battleId!: string;

    @ApiProperty({ example: 2 })
    currentRound!: number;

    @ApiProperty({ example: false })
    isInIntermission!: boolean;

    @ApiProperty({ type: [ClanWarsTeamStandingsDto] })
    teams!: ClanWarsTeamStandingsDto[];
}
