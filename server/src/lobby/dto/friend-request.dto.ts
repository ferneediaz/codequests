import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LobbyFriendRequestDto {
    @ApiProperty({ description: 'User ID to send a friend request to' })
    @IsString()
    @IsNotEmpty()
    targetUserId!: string;
}
