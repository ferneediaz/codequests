import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SyncUserDto } from './dto/sync-user.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { AuthedRequest } from '../common/types/authed-request';

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
    @Req() req: AuthedRequest,
    @Body() body: SyncUserDto,
  ) {
    if (!req.user.email) {
      throw new BadRequestException('JWT is missing the `email` claim');
    }
    return this.authService.syncUser(
      req.user.id,
      req.user.email,
      body.username,
      req.user.role,
      body.avatarUrl,
    );
  }

  /**
   * Complete the first-time profile wizard. Requires POST /auth/sync first.
   * Idempotent: calling again after completion returns the current profile.
   */
  @Post('onboarding')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Complete onboarding profile' })
  @ApiBody({ type: CompleteOnboardingDto })
  @ApiResponse({ status: 200, description: 'Profile saved', type: MeResponseDto })
  async completeOnboarding(
    @Req() req: AuthedRequest,
    @Body() body: CompleteOnboardingDto,
  ) {
    return this.authService.completeOnboarding(req.user.id, body);
  }

  /**
   * Update the authenticated user's avatar URL. The client uploads the
   * image to Supabase Storage and then calls this endpoint with the
   * resulting public URL; the server just persists the reference.
   */
  @Patch('avatar')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update avatar URL' })
  @ApiBody({ type: UpdateAvatarDto })
  @ApiResponse({ status: 200, description: 'Avatar updated', type: MeResponseDto })
  async updateAvatar(
    @Req() req: AuthedRequest,
    @Body() body: UpdateAvatarDto,
  ) {
    return this.authService.updateAvatar(req.user.id, body);
  }

  /**
   * Get current authenticated user's profile.
   */
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns current user', type: MeResponseDto })
  async getMe(@Req() req: AuthedRequest) {
    return this.authService.getMe(req.user.id);
  }
}
