import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClanMemberDto {
    @ApiProperty({ example: 'user-123' })
    id: string;

    @ApiProperty({ example: 'alice_coder' })
    username: string;

    @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
    avatarUrl?: string;

    @ApiProperty({ example: 1200 })
    mmr: number;
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

    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    createdAt: Date;
}
