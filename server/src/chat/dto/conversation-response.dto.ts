import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConversationParticipantDto {
    @ApiProperty({ description: 'User ID' })
    id: string;

    @ApiProperty({ description: 'Username' })
    username: string;

    @ApiPropertyOptional({ description: 'Avatar URL' })
    avatarUrl?: string;
}

export class ConversationResponseDto {
    @ApiProperty({ description: 'Conversation ID' })
    id: string;

    @ApiProperty({ description: 'Conversation type (DM or GROUP)' })
    type: string;

    @ApiProperty({ description: 'Participants', type: [ConversationParticipantDto] })
    participants: ConversationParticipantDto[];

    @ApiPropertyOptional({ description: 'Last message in conversation' })
    lastMessage?: {
        content: string;
        senderId: string;
        createdAt: Date;
    };

    @ApiProperty({ description: 'When the conversation was created' })
    createdAt: Date;
}
