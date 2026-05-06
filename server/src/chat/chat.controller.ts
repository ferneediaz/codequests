import {
    Controller,
    Get,
    Post,
    Param,
    ParseIntPipe,
    Query,
    Body,
    UseGuards,
    Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { CreateConversationDto, MessageResponseDto, ConversationResponseDto } from './dto';
import { ChatRoomType } from '@prisma/client';
import { AuthedRequest } from '../common/types/authed-request';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    /**
     * Get user's DM conversations
     */
    @Get('conversations')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Get user\'s DM conversations' })
    @ApiResponse({ status: 200, description: 'List of conversations', type: [ConversationResponseDto] })
    getConversations(@Req() req: AuthedRequest) {
        return this.chatService.getConversations(req.user.id);
    }

    /**
     * Create a DM conversation with another user
     */
    @Post('conversations')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Create a DM conversation (requires friendship)' })
    @ApiResponse({ status: 201, description: 'Conversation created', type: ConversationResponseDto })
    @ApiResponse({ status: 400, description: 'Not friends or self-conversation' })
    @ApiResponse({ status: 404, description: 'User not found' })
    createConversation(
        @Body() dto: CreateConversationDto,
        @Req() req: AuthedRequest,
    ) {
        return this.chatService.createConversation(req.user.id, dto.targetUserId);
    }

    @Get('unread-counts')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Get unread DM counts' })
    @ApiResponse({ status: 200, description: 'Unread DM counts' })
    getUnreadCounts(@Req() req: AuthedRequest) {
        return this.chatService.getUnreadCounts(req.user.id);
    }

    @Post(':roomType/:roomId/read')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Mark a chat room as read' })
    @ApiParam({ name: 'roomType', enum: ChatRoomType, description: 'Room type' })
    @ApiParam({ name: 'roomId', description: 'Room ID' })
    @ApiResponse({ status: 200, description: 'Room marked read' })
    markRead(
        @Param('roomType') roomType: ChatRoomType,
        @Param('roomId') roomId: string,
        @Req() req: AuthedRequest,
    ) {
        return this.chatService.markRead(req.user.id, roomType, roomId);
    }

    /**
     * Get message history for a chat room (paginated)
     */
    @Get(':roomType/:roomId')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Get message history for a chat room' })
    @ApiParam({ name: 'roomType', enum: ChatRoomType, description: 'Room type' })
    @ApiParam({ name: 'roomId', description: 'Room ID (battleId, "lobby", or conversationId)' })
    @ApiQuery({ name: 'cursor', required: false, description: 'Cursor for pagination (message ID)' })
    @ApiQuery({ name: 'limit', required: false, description: 'Number of messages to return (default 50, max 100)' })
    @ApiResponse({ status: 200, description: 'Message history', type: [MessageResponseDto] })
    @ApiResponse({ status: 403, description: 'Not authorized to access this room' })
    async getMessages(
        @Param('roomType') roomType: ChatRoomType,
        @Param('roomId') roomId: string,
        @Req() req: AuthedRequest,
        @Query('cursor') cursor?: string,
        @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    ) {
        await this.chatService.validateRoomAccess(req.user.id, roomType, roomId);

        return this.chatService.getMessages(roomType, roomId, cursor, limit);
    }
}
