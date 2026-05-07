import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { AchievementsService } from './achievements.service';
import { AchievementResponseDto } from './dto/achievement-response.dto';
import { AuthedRequest } from '../common/types/authed-request';

@ApiTags('achievements')
@Controller('achievements')
export class AchievementsController {
    constructor(private readonly achievements: AchievementsService) {}

    @Get('me')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Achievements for the authenticated user (locked + unlocked)',
    })
    @ApiResponse({
        status: 200,
        type: AchievementResponseDto,
        isArray: true,
    })
    listMine(@Req() req: AuthedRequest) {
        return this.achievements.listForUser(req.user.id);
    }

    @Get(':userId')
    @ApiOperation({
        summary: "Achievements for a public profile (locked + unlocked)",
        description:
            'Public — returns the same shape as /achievements/me but for any user, used by /profile/:username.',
    })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiResponse({
        status: 200,
        type: AchievementResponseDto,
        isArray: true,
    })
    listForUser(@Param('userId') userId: string) {
        return this.achievements.listForUser(userId);
    }
}
