import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsEnum } from 'class-validator';
import { ChatRoomType } from '@prisma/client';

export class SendMessageDto {
    @ApiProperty({
        description: 'Message content',
        example: 'Hello everyone!',
        maxLength: 1000,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(1000)
    content!: string;

    @ApiProperty({
        description: 'Room type',
        enum: ChatRoomType,
        example: 'LOBBY',
    })
    @IsEnum(ChatRoomType)
    roomType!: ChatRoomType;

    @ApiProperty({
        description: 'Room ID (battleId, "lobby", or conversationId)',
        example: 'lobby',
    })
    @IsString()
    @IsNotEmpty()
    roomId!: string;
}
