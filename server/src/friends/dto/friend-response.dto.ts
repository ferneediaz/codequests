import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FriendResponseDto {
    @ApiProperty({ description: 'User ID', example: 'uuid-123' })
    id: string;

    @ApiProperty({ description: 'Username', example: 'john_doe' })
    username: string;

    @ApiPropertyOptional({ description: 'Avatar URL' })
    avatarUrl?: string;

    @ApiProperty({ description: 'MMR rating', example: 1200 })
    mmr: number;
}

export class FriendshipResponseDto {
    @ApiProperty({ description: 'Friendship record ID' })
    id: string;

    @ApiProperty({ description: 'User who sent the request' })
    requester: {
        id: string;
        username: string;
        avatarUrl?: string;
        mmr: number;
    };

    @ApiProperty({ description: 'When the request was sent' })
    createdAt: Date;
}
