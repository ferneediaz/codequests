import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
  ) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: supabaseUserId },
    });

    if (existingUser) {
      // Update role if provided and different
      if (role && role !== existingUser.role) {
        return this.prisma.user.update({
          where: { id: supabaseUserId },
          data: { role },
        });
      }
      return existingUser;
    }

    // Create new user in our database
    return this.prisma.user.create({
      data: {
        id: supabaseUserId, // Use same ID as Supabase
        email,
        username: username || email.split('@')[0], // Default username from email
        role: role || 'user', // Default to 'user' role
      },
    });
  }

  /**
   * Get user by Supabase ID
   */
  async getUser(supabaseUserId: string) {
    return this.prisma.user.findUnique({
      where: { id: supabaseUserId },
      include: { clan: true },
    });
  }
}
