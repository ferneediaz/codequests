import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
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
} from '@nestjs/swagger';
import { FriendsService } from './friends.service';
import { SendRequestDto, FriendResponseDto, FriendshipResponseDto } from './dto';
import { AuthedRequest } from '../common/types/authed-request';

@ApiTags('friends')
@Controller('friends')
export class FriendsController {
    constructor(private readonly friendsService: FriendsService) {}

    /**
     * Send a friend request
     */
    @Post('request')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Send a friend request' })
    @ApiResponse({ status: 201, description: 'Friend request sent' })
    @ApiResponse({ status: 404, description: 'User not found' })
    @ApiResponse({ status: 409, description: 'Already friends or request pending' })
    sendRequest(
        @Body() dto: SendRequestDto,
        @Req() req: AuthedRequest,
    ) {
        return this.friendsService.sendRequest(req.user.id, dto.username);
    }

    /**
     * Accept a friend request
     */
    @Post(':id/accept')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Accept a friend request' })
    @ApiParam({ name: 'id', description: 'Friendship ID' })
    @ApiResponse({ status: 200, description: 'Friend request accepted' })
    @ApiResponse({ status: 404, description: 'Request not found' })
    acceptRequest(
        @Param('id') id: string,
        @Req() req: AuthedRequest,
    ) {
        return this.friendsService.acceptRequest(req.user.id, id);
    }

    /**
     * Decline a friend request
     */
    @Post(':id/decline')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Decline a friend request' })
    @ApiParam({ name: 'id', description: 'Friendship ID' })
    @ApiResponse({ status: 200, description: 'Friend request declined' })
    @ApiResponse({ status: 404, description: 'Request not found' })
    declineRequest(
        @Param('id') id: string,
        @Req() req: AuthedRequest,
    ) {
        return this.friendsService.declineRequest(req.user.id, id);
    }

    /**
     * Cancel a pending outgoing friend request. Declared before
     * `DELETE /:id` so Nest matches the static segment first.
     */
    @Delete('sent/:id')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Cancel a pending outgoing friend request' })
    @ApiParam({ name: 'id', description: 'Friendship ID' })
    @ApiResponse({ status: 200, description: 'Friend request cancelled' })
    @ApiResponse({ status: 400, description: 'Request is not yours or not pending' })
    @ApiResponse({ status: 404, description: 'Request not found' })
    cancelOutgoingRequest(
        @Param('id') id: string,
        @Req() req: AuthedRequest,
    ) {
        return this.friendsService.cancelOutgoingRequest(req.user.id, id);
    }

    /**
     * Remove a friend
     */
    @Delete(':id')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Remove a friend (pass friend user ID)' })
    @ApiParam({ name: 'id', description: 'Friend user ID' })
    @ApiResponse({ status: 200, description: 'Friend removed' })
    @ApiResponse({ status: 404, description: 'Friendship not found' })
    removeFriend(
        @Param('id') id: string,
        @Req() req: AuthedRequest,
    ) {
        return this.friendsService.removeFriend(req.user.id, id);
    }

    /**
     * Get list of friends (with online status)
     */
    @Get()
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Get friends list with online status' })
    @ApiResponse({ status: 200, description: 'List of friends', type: [FriendResponseDto] })
    getFriends(@Req() req: AuthedRequest) {
        return this.friendsService.getFriends(req.user.id);
    }

    /**
     * Get pending friend requests
     */
    @Get('requests')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Get pending friend requests' })
    @ApiResponse({ status: 200, description: 'List of pending requests', type: [FriendshipResponseDto] })
    getPendingRequests(@Req() req: AuthedRequest) {
        return this.friendsService.getPendingRequests(req.user.id);
    }

    /**
     * Get sent friend requests
     */
    @Get('sent')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({ summary: 'Get sent pending friend requests' })
    @ApiResponse({ status: 200, description: 'List of sent requests', type: [FriendshipResponseDto] })
    getSentRequests(@Req() req: AuthedRequest) {
        return this.friendsService.getSentRequests(req.user.id);
    }
}
