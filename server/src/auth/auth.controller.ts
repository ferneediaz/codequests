import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SyncUserDto } from './dto/sync-user.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  /**
   * Sync user from Supabase to our database.
   * Call this after a user signs up or logs in via Supabase.
   */
  @Post('sync')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Sync Supabase user to database' })
  @ApiResponse({ status: 201, description: 'User synced successfully' })
  @ApiBody({ type: SyncUserDto })
  async syncUser(
    @Req() req: Request & { user: { id: string; email: string; role?: string } },
    @Body() body: SyncUserDto,
  ) {
    return this.authService.syncUser(
      req.user.id,
      req.user.email,
      body.username,
      req.user.role,
    );
  }

  /**
   * Get current authenticated user's profile.
   */
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns current user' })
  async getMe(@Req() req: Request & { user: { id: string } }) {
    return this.authService.getUser(req.user.id);
  }
}
