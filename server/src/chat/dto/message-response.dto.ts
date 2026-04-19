import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageResponseDto {
    @ApiProperty({ description: 'Message ID' })
    id: string;

    @ApiProperty({ description: 'Sender user ID' })
    senderId: string;

    @ApiProperty({ description: 'Sender username' })
    senderUsername: string;

    @ApiPropertyOptional({ description: 'Sender avatar URL' })
    senderAvatarUrl?: string;

    @ApiProperty({ description: 'Message content' })
    content: string;

    @ApiProperty({ description: 'Room type (BATTLE, LOBBY, DM)' })
    roomType: string;

    @ApiProperty({ description: 'Room ID' })
    roomId: string;

    @ApiProperty({ description: 'When the message was sent' })
    createdAt: Date;
}
