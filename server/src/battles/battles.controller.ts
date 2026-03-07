import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    UseGuards,
    Query,
    Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiQuery,
    ApiParam,
} from '@nestjs/swagger';
import { BattlesService } from './battles.service';
import { CreateBattleDto, SubmitSolutionDto, BattleResponseDto, BattleHistoryResponseDto } from './dto';

// Extend Express Request to include user
interface AuthRequest extends Request {
    user: {
        sub: string;
        email: string;
        role?: string;
    };
}

@ApiTags('battles')
@Controller('battles')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('access-token')
export class BattlesController {
    constructor(private readonly battlesService: BattlesService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new battle' })
    @ApiResponse({
        status: 201,
        description: 'Battle created successfully',
        type: BattleResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Problem not found' })
    async create(
        @Req() req: AuthRequest,
        @Body() createBattleDto: CreateBattleDto,
    ) {
        return this.battlesService.createBattle(req.user.sub, createBattleDto);
    }

    @Get('available')
    @ApiOperation({ summary: 'Get available battles to join' })
    @ApiResponse({
        status: 200,
        description: 'Returns list of available battles',
        type: [BattleResponseDto],
    })
    async getAvailable(@Req() req: AuthRequest) {
        return this.battlesService.getAvailableBattles(req.user.sub);
    }

    @Get('history')
    @ApiOperation({ summary: "Get user's battle history" })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'Page number (default: 1)',
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Items per page (default: 20)',
    })
    @ApiResponse({
        status: 200,
        description: "Returns user's battle history",
        type: BattleHistoryResponseDto,
    })
    async getHistory(
        @Req() req: AuthRequest,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.battlesService.getBattleHistory(
            req.user.sub,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 20,
        );
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get battle details' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({
        status: 200,
        description: 'Returns battle details',
        type: BattleResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Battle not found' })
    async getBattle(@Param('id') id: string) {
        return this.battlesService.getBattleDetails(id);
    }

    @Post(':id/join')
    @ApiOperation({ summary: 'Join an existing battle' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({
        status: 200,
        description: 'Successfully joined battle',
        type: BattleResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Cannot join battle' })
    @ApiResponse({ status: 404, description: 'Battle not found' })
    async joinBattle(@Req() req: AuthRequest, @Param('id') id: string) {
        return this.battlesService.joinBattle(req.user.sub, id);
    }

    @Post(':id/submit')
    @ApiOperation({ summary: 'Submit a solution for the battle' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({
        status: 200,
        description: 'Solution submitted and evaluated',
    })
    @ApiResponse({ status: 400, description: 'Battle not in progress' })
    @ApiResponse({ status: 403, description: 'Not a participant' })
    @ApiResponse({ status: 404, description: 'Battle not found' })
    async submitSolution(
        @Req() req: AuthRequest,
        @Param('id') id: string,
        @Body() submitDto: SubmitSolutionDto,
    ) {
        return this.battlesService.submitSolution(
            id,
            req.user.sub,
            submitDto.code,
            submitDto.language,
            submitDto.problemId,
        );
    }

    @Post(':id/complete')
    @ApiOperation({ summary: 'Force complete a battle (for timeouts)' })
    @ApiParam({ name: 'id', description: 'Battle ID' })
    @ApiResponse({
        status: 200,
        description: 'Battle completed',
        type: BattleResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Battle already completed' })
    @ApiResponse({ status: 404, description: 'Battle not found' })
    async completeBattle(@Param('id') id: string) {
        return this.battlesService.completeBattle(id);
    }
}
