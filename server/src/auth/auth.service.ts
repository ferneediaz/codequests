import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AvatarSource, Clan, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { MeUser } from './dto/me-response.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';

type UserWithClan = User & { clan: Clan | null };

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) { }

  /**
   * Create or update user in our database when they sign up via Supabase.
   * Called after Supabase Auth confirms the user.
   */
  async syncUser(
    supabaseUserId: string,
    email: string,
    username?: string,
    role?: string,
    avatarUrl?: string,
    githubUsername?: string,
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: supabaseUserId },
    });

    if (existingUser) {
      // Build a single update payload covering role drift and avatar
      // backfill. We only backfill `avatarUrl` when the row is still
      // null (or the previous source was OAUTH); user-uploaded avatars
      // are sticky and must not be clobbered by the provider picture.
      const patch: {
        role?: string;
        avatarUrl?: string;
        avatarSource?: 'OAUTH';
        githubUsername?: string;
      } = {};
      if (role && role !== existingUser.role) {
        patch.role = role;
      }
      const canBackfillAvatar =
        !!avatarUrl &&
        (!existingUser.avatarUrl || existingUser.avatarSource === 'OAUTH') &&
        avatarUrl !== existingUser.avatarUrl;
      if (canBackfillAvatar) {
        patch.avatarUrl = avatarUrl;
        patch.avatarSource = 'OAUTH';
      }
      if (githubUsername && githubUsername !== existingUser.githubUsername) {
        patch.githubUsername = githubUsername;
      }
      if (Object.keys(patch).length === 0) {
        return existingUser;
      }
      return this.prisma.user.update({
        where: { id: supabaseUserId },
        data: patch,
      });
    }

    // Create new user in our database (onboarding not completed until POST /auth/onboarding).
    // OAuth provider avatars are stored with `avatarSource: OAUTH` so we can
    // tell them apart from user-uploaded pictures.
    return this.prisma.user.create({
      data: {
        id: supabaseUserId, // Use same ID as Supabase
        email,
        username: username || email.split('@')[0], // Default username from email
        role: role || 'user', // Default to 'user' role
        ...(avatarUrl
          ? { avatarUrl, avatarSource: 'OAUTH' as const }
          : {}),
        ...(githubUsername ? { githubUsername } : {}),
      },
    });
  }

  /**
   * Get user by Supabase ID (raw row; no `needsOnboarding` helper)
   */
  async getUser(supabaseUserId: string) {
    return this.prisma.user.findUnique({
      where: { id: supabaseUserId },
      include: { clan: true },
    });
  }

  /**
   * Profile for the authenticated client, including onboarding gate
   */
  async getMe(supabaseUserId: string): Promise<MeUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: supabaseUserId },
      include: { clan: true },
    });
    if (!user) {
      return null;
    }
    return this.toMeResponse(user);
  }

  /**
   * Complete first-time profile wizard. Idempotent: if already completed, returns current user.
   */
  async completeOnboarding(
    supabaseUserId: string,
    dto: CompleteOnboardingDto,
  ): Promise<MeUser> {
    const existing = await this.prisma.user.findUnique({
      where: { id: supabaseUserId },
      include: { clan: true },
    });
    if (!existing) {
      throw new BadRequestException('Sync your account first (POST /auth/sync).');
    }
    if (existing.onboardingCompletedAt !== null) {
      return this.toMeResponse(existing);
    }
    if (dto.username !== existing.username) {
      const taken = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (taken) {
        throw new ConflictException('Username already taken');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: supabaseUserId },
      data: {
        username: dto.username,
        userSegment: dto.userSegment,
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ...(dto.codingExperience !== undefined
          ? { codingExperience: dto.codingExperience }
          : {}),
        ...(dto.primaryGoal !== undefined ? { primaryGoal: dto.primaryGoal } : {}),
        ...(dto.howHeard !== undefined ? { howHeard: dto.howHeard } : {}),
        ...(dto.avatarSource !== undefined
          ? { avatarSource: dto.avatarSource }
          : {}),
        onboardingCompletedAt: new Date(),
      },
      include: { clan: true },
    });
    return this.toMeResponse(updated);
  }

  /**
   * Update the authenticated user's avatar. Callers are responsible for
   * uploading the image (e.g. to Supabase Storage) and passing the
   * resulting public URL; we only store the reference.
   */
  async updateAvatar(
    supabaseUserId: string,
    dto: UpdateAvatarDto,
  ): Promise<MeUser> {
    const existing = await this.prisma.user.findUnique({
      where: { id: supabaseUserId },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    const updated = await this.prisma.user.update({
      where: { id: supabaseUserId },
      data: {
        avatarUrl: dto.avatarUrl,
        avatarSource: dto.avatarSource ?? AvatarSource.URL,
      },
      include: { clan: true },
    });
    return this.toMeResponse(updated);
  }

  private toMeResponse(user: UserWithClan): MeUser {
    return {
      ...user,
      needsOnboarding: user.onboardingCompletedAt === null,
    };
  }
}
