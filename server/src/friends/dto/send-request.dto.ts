import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SendRequestDto {
    @ApiProperty({
        description: 'Username of the user to send a friend request to',
        example: 'john_doe',
    })
    @IsString()
    @IsNotEmpty()
    username!: string;
}
