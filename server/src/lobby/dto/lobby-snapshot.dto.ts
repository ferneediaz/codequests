import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type LobbyFriendship =
    | 'NONE'
    | 'PENDING_OUT'
    | 'PENDING_IN'
    | 'ACCEPTED'
    | 'SELF';

export class LobbyClanSummaryDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    tag: string;

    @ApiProperty()
    mmr: number;
}

export class LobbyUserDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    username: string;

    @ApiPropertyOptional({ nullable: true })
    avatarUrl?: string | null;

    @ApiProperty()
    mmr: number;

    @ApiPropertyOptional({ nullable: true, type: () => LobbyClanSummaryDto })
    clan?: LobbyClanSummaryDto | null;

    @ApiProperty({
        enum: ['NONE', 'PENDING_OUT', 'PENDING_IN', 'ACCEPTED', 'SELF'],
    })
    friendship: LobbyFriendship;

    @ApiPropertyOptional({
        description:
            'When friendship is PENDING_IN this contains the friendship ID so the UI can accept/decline it inline.',
    })
    friendshipId?: string | null;
}

export class LobbyClanDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    tag: string;

    @ApiProperty()
    mmr: number;

    @ApiProperty()
    memberCount: number;

    @ApiProperty()
    onlineCount: number;
}

export class LobbySnapshotDto {
    @ApiProperty({ type: [LobbyUserDto] })
    users: LobbyUserDto[];

    @ApiProperty({ type: [LobbyClanDto] })
    clans: LobbyClanDto[];

    @ApiProperty()
    onlineCount: number;
}

export class LobbyPresenceUserDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    username: string;

    @ApiPropertyOptional({ nullable: true })
    avatarUrl?: string | null;

    @ApiProperty()
    mmr: number;

    @ApiPropertyOptional({ nullable: true, type: () => LobbyClanSummaryDto })
    clan?: LobbyClanSummaryDto | null;
}

export class LobbyPresenceDeltaDto {
    @ApiProperty({ enum: ['online', 'offline'] })
    type: 'online' | 'offline';

    @ApiProperty({ type: () => LobbyPresenceUserDto })
    user: LobbyPresenceUserDto;
}
