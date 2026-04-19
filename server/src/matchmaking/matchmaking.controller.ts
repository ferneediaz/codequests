import {
    Controller,
    Get,
    Post,
    Delete,
    Body,
    UseGuards,
    Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
} from '@nestjs/swagger';
import { MatchmakingService } from './matchmaking.service';
import { JoinQueueDto, QueueStatusResponseDto } from './dto';

interface AuthRequest extends Request {
    user: {
        sub: string;
        email: string;
        role?: string;
    };
}

@ApiTags('matchmaking')
@Controller('matchmaking')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('access-token')
export class MatchmakingController {
    constructor(private readonly matchmakingService: MatchmakingService) {}

    @Post('queue')
    @ApiOperation({ summary: 'Join the matchmaking queue' })
    @ApiResponse({
        status: 201,
        description: 'Joined queue or immediately matched',
    })
    @ApiResponse({ status: 400, description: 'Already in queue or in active battle' })
    async joinQueue(
        @Req() req: AuthRequest,
        @Body() dto: JoinQueueDto,
    ) {
        return this.matchmakingService.joinQueue(req.user.sub, dto);
    }

    @Delete('queue')
    @ApiOperation({ summary: 'Leave the matchmaking queue' })
    @ApiResponse({ status: 200, description: 'Left queue successfully' })
    @ApiResponse({ status: 400, description: 'Not currently in queue' })
    async leaveQueue(@Req() req: AuthRequest) {
        return this.matchmakingService.leaveQueue(req.user.sub);
    }

    @Get('status')
    @ApiOperation({ summary: 'Check matchmaking queue status' })
    @ApiResponse({
        status: 200,
        description: 'Current queue status',
        type: QueueStatusResponseDto,
    })
    async getStatus(@Req() req: AuthRequest) {
        return this.matchmakingService.getQueueStatus(req.user.sub);
    }
}
