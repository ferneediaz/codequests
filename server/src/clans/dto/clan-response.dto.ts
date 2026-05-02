import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RankTierDto } from '../../common/dto/rank-tier.dto';

export class ClanMemberDto {
    @ApiProperty({ example: 'user-123' })
    id: string;

    @ApiProperty({ example: 'alice_coder' })
    username: string;

    @ApiPropertyOptional({ example: 'https://example.com/avatar.png', nullable: true })
    avatarUrl?: string | null;

    @ApiProperty({ example: 1200 })
    mmr: number;

    @ApiPropertyOptional({
        example: 12,
        description: 'Member wins (only populated by GET /clans/:id; omitted on list endpoints).',
    })
    wins?: number;

    @ApiPropertyOptional({
        example: 5,
        description: 'Member losses (only populated by GET /clans/:id; omitted on list endpoints).',
    })
    losses?: number;
}

export class ClanResponseDto {
    @ApiProperty({ example: 'clan-123' })
    id: string;

    @ApiProperty({ example: 'Code Warriors' })
    name: string;

    @ApiProperty({ example: 'CW' })
    tag: string;

    @ApiProperty({ example: 'user-owner-123' })
    ownerId: string;

    @ApiProperty({ example: 1000, description: 'Clan MMR for clan vs clan battles' })
    mmr: number;

    @ApiProperty({ type: [ClanMemberDto] })
    members: ClanMemberDto[];

    @ApiProperty({ type: RankTierDto, description: 'Rank tier derived from clan MMR' })
    tier: RankTierDto;

    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    createdAt: Date;
}
