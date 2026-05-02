import {
    Controller,
    Get,
    Post,
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
} from '@nestjs/swagger';
import { LobbyService } from './lobby.service';
import {
    LobbySnapshotDto,
    ChallengeUserDto,
    LobbyFriendRequestDto,
} from './dto';
import { AuthedRequest } from '../common/types/authed-request';

@ApiTags('lobby')
@Controller('lobby')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('access-token')
export class LobbyController {
    constructor(private readonly lobbyService: LobbyService) {}

    /**
     * Hydrate the lobby UI on mount. After receiving this snapshot the
     * client subscribes to `lobby.presence_delta` to keep lists fresh.
     */
    @Get('snapshot')
    @ApiOperation({
        summary:
            'Get the current lobby snapshot (online users + clans + friendship hints)',
    })
    @ApiResponse({
        status: 200,
        description: 'Lobby snapshot',
        type: LobbySnapshotDto,
    })
    getSnapshot(@Req() req: AuthedRequest) {
        return this.lobbyService.getSnapshot(req.user.id);
    }

    /**
     * Send a friend request by user ID (lobby-friendly variant of the
     * username-based `/friends/request`).
     */
    @Post('friend-request')
    @ApiOperation({ summary: 'Send a friend request by user ID' })
    @ApiResponse({ status: 201, description: 'Friend request sent' })
    sendFriendRequest(
        @Body() dto: LobbyFriendRequestDto,
        @Req() req: AuthedRequest,
    ) {
        return this.lobbyService.sendFriendRequestById(
            req.user.id,
            dto.targetUserId,
        );
    }

    /**
     * Create a 1v1 battle invite for another online user. The target sees a
     * standard `battle.invite_received` toast; the inviter should navigate
     * to `/battle/:id` to wait for acceptance.
     */
    @Post('challenge')
    @ApiOperation({
        summary: 'Challenge another online user to a 1v1 battle',
    })
    @ApiResponse({ status: 201, description: 'Challenge sent' })
    challenge(@Body() dto: ChallengeUserDto, @Req() req: AuthedRequest) {
        return this.lobbyService.challengeUser(
            req.user.id,
            dto.targetUserId,
            dto.timeLimitMinutes,
        );
    }
}
