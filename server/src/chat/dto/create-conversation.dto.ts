import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateConversationDto {
    @ApiProperty({
        description: 'User ID to start a DM conversation with',
        example: 'uuid-123',
    })
    @IsString()
    @IsNotEmpty()
    targetUserId!: string;
}
