import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FriendResponseDto {
    @ApiProperty({ description: 'Friend user ID', example: 'uuid-123' })
    id: string;

    @ApiProperty({ description: 'Username', example: 'john_doe' })
    username: string;

    @ApiPropertyOptional({ description: 'Avatar URL', nullable: true })
    avatarUrl?: string | null;

    @ApiProperty({ description: 'MMR rating', example: 1200 })
    mmr: number;

    @ApiProperty({
        description:
            'ID of the underlying Friendship row (used by remove/block endpoints).',
        example: 'friendship-uuid-456',
    })
    friendshipId: string;
}

class FriendRequesterDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    username: string;

    @ApiPropertyOptional({ nullable: true })
    avatarUrl?: string | null;

    @ApiProperty()
    mmr: number;
}

export class FriendshipResponseDto {
    @ApiProperty({ description: 'Friendship record ID' })
    id: string;

    @ApiProperty({
        description: 'User who sent the request',
        type: FriendRequesterDto,
    })
    requester: FriendRequesterDto;

    @ApiProperty({ description: 'When the request was sent' })
    createdAt: Date;
}
