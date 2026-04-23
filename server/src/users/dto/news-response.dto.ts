import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * News feed event types.
 *
 * CLAN_CHALLENGE_* events are globally visible to all users.
 * FRIEND_BATTLE_RESULT events are viewer-scoped — only surfaced when at
 * least one participant of the completed battle is in the viewer's
 * accepted-friends set.
 */
export type NewsItemType =
    | 'CLAN_CHALLENGE_SENT'
    | 'CLAN_CHALLENGE_ACCEPTED'
    | 'CLAN_CHALLENGE_DECLINED'
    | 'CLAN_CHALLENGE_COUNTERED'
    | 'CLAN_CHALLENGE_EXPIRED'
    | 'FRIEND_BATTLE_RESULT';

export type NewsItemSeverity = 'neutral' | 'positive' | 'warning' | 'negative';

/**
 * High-level grouping used by the UI's filter tabs.
 *
 * An item may belong to multiple categories — e.g. a DECLINED challenge is
 * both `clan` and `shame`. We keep it as a single primary + an extra
 * `isShame` boolean so filters can be combined without duplicating rows.
 */
export type NewsItemCategory = 'clan' | 'friends';

export class NewsClanRefDto {
    @ApiProperty({ description: 'Clan ID' })
    id!: string;

    @ApiProperty({ description: 'Clan name' })
    name!: string;

    @ApiProperty({ description: 'Clan tag' })
    tag!: string;
}

export class NewsUserRefDto {
    @ApiProperty({ description: 'User ID' })
    id!: string;

    @ApiProperty({ description: 'Username' })
    username!: string;

    @ApiPropertyOptional({ description: 'Avatar URL', nullable: true })
    avatarUrl?: string | null;
}

export class NewsItemDto {
    @ApiProperty({ description: 'Stable unique id for the news item' })
    id!: string;

    @ApiProperty({
        description: 'Event type',
        enum: [
            'CLAN_CHALLENGE_SENT',
            'CLAN_CHALLENGE_ACCEPTED',
            'CLAN_CHALLENGE_DECLINED',
            'CLAN_CHALLENGE_COUNTERED',
            'CLAN_CHALLENGE_EXPIRED',
            'FRIEND_BATTLE_RESULT',
        ],
    })
    type!: NewsItemType;

    @ApiProperty({ description: 'UI severity for styling' })
    severity!: NewsItemSeverity;

    @ApiProperty({ description: 'Primary category for filtering (clan|friends)' })
    category!: NewsItemCategory;

    @ApiProperty({
        description:
            'True when the event should be highlighted as a "shame" moment (declined / expired challenge)',
    })
    isShame!: boolean;

    @ApiProperty({ description: 'When the event occurred (ISO timestamp)' })
    timestamp!: string;

    @ApiProperty({ description: 'Pre-rendered short description' })
    text!: string;

    @ApiPropertyOptional({ description: 'Clan initiating the event', type: NewsClanRefDto })
    challengerClan?: NewsClanRefDto;

    @ApiPropertyOptional({ description: 'Clan receiving the event', type: NewsClanRefDto })
    challengedClan?: NewsClanRefDto;

    @ApiPropertyOptional({ description: 'Battle id (friend battle result only)' })
    battleId?: string;

    @ApiPropertyOptional({ description: 'Battle winner (friend battle result only)', type: NewsUserRefDto })
    winner?: NewsUserRefDto | null;

    @ApiPropertyOptional({ description: 'Battle loser (friend battle result only)', type: NewsUserRefDto })
    loser?: NewsUserRefDto | null;

    @ApiPropertyOptional({
        description: 'All participants of the battle (friend battle result only)',
        type: [NewsUserRefDto],
    })
    participants?: NewsUserRefDto[];

    @ApiPropertyOptional({ description: 'Battle mode (friend battle result only)' })
    battleMode?: string;

    @ApiPropertyOptional({ description: 'True when the battle ended in a draw' })
    isDraw?: boolean;
}

export class NewsResponseDto {
    @ApiProperty({ description: 'News items sorted by timestamp desc', type: [NewsItemDto] })
    items!: NewsItemDto[];

    @ApiPropertyOptional({
        description:
            'Cursor (ISO timestamp) to pass as `before` to fetch the next page; null when no more items',
        nullable: true,
    })
    nextCursor!: string | null;
}
