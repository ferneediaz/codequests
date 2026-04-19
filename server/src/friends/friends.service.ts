import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipStatus } from '@prisma/client';

@Injectable()
export class FriendsService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Send a friend request to a user by username
     */
    async sendRequest(requesterId: string, addresseeUsername: string) {
        // Look up the addressee
        const addressee = await this.prisma.user.findUnique({
            where: { username: addresseeUsername },
        });

        if (!addressee) {
            throw new NotFoundException(`User "${addresseeUsername}" not found`);
        }

        // Prevent self-request
        if (addressee.id === requesterId) {
            throw new BadRequestException('You cannot send a friend request to yourself');
        }

        // Check for existing friendship in either direction
        const existing = await this.prisma.friendship.findFirst({
            where: {
                OR: [
                    { requesterId, addresseeId: addressee.id },
                    { requesterId: addressee.id, addresseeId: requesterId },
                ],
            },
        });

        if (existing) {
            if (existing.status === FriendshipStatus.ACCEPTED) {
                throw new ConflictException('You are already friends with this user');
            }
            if (existing.status === FriendshipStatus.PENDING) {
                throw new ConflictException('A friend request is already pending');
            }
            // DECLINED — delete old record and allow re-request (use transaction to prevent race conditions)
            return this.prisma.$transaction(async (tx) => {
                await tx.friendship.delete({ where: { id: existing.id } });
                return tx.friendship.create({
                    data: {
                        requesterId,
                        addresseeId: addressee.id,
                        status: FriendshipStatus.PENDING,
                    },
                    include: {
                        addressee: {
                            select: { id: true, username: true, avatarUrl: true, mmr: true },
                        },
                    },
                });
            });
        }

        return this.prisma.friendship.create({
            data: {
                requesterId,
                addresseeId: addressee.id,
                status: FriendshipStatus.PENDING,
            },
            include: {
                addressee: {
                    select: { id: true, username: true, avatarUrl: true, mmr: true },
                },
            },
        });
    }

    /**
     * Accept a pending friend request
     */
    async acceptRequest(userId: string, friendshipId: string) {
        const friendship = await this.prisma.friendship.findUnique({
            where: { id: friendshipId },
        });

        if (!friendship) {
            throw new NotFoundException('Friend request not found');
        }

        if (friendship.addresseeId !== userId) {
            throw new BadRequestException('You can only accept requests sent to you');
        }

        if (friendship.status !== FriendshipStatus.PENDING) {
            throw new BadRequestException('This request is not pending');
        }

        return this.prisma.friendship.update({
            where: { id: friendshipId },
            data: { status: FriendshipStatus.ACCEPTED },
            include: {
                requester: {
                    select: { id: true, username: true, avatarUrl: true, mmr: true },
                },
            },
        });
    }

    /**
     * Decline a pending friend request
     */
    async declineRequest(userId: string, friendshipId: string) {
        const friendship = await this.prisma.friendship.findUnique({
            where: { id: friendshipId },
        });

        if (!friendship) {
            throw new NotFoundException('Friend request not found');
        }

        if (friendship.addresseeId !== userId) {
            throw new BadRequestException('You can only decline requests sent to you');
        }

        if (friendship.status !== FriendshipStatus.PENDING) {
            throw new BadRequestException('This request is not pending');
        }

        return this.prisma.friendship.update({
            where: { id: friendshipId },
            data: { status: FriendshipStatus.DECLINED },
        });
    }

    /**
     * Remove a friend by their user ID
     */
    async removeFriend(userId: string, friendId: string) {
        const friendship = await this.prisma.friendship.findFirst({
            where: {
                status: FriendshipStatus.ACCEPTED,
                OR: [
                    { requesterId: userId, addresseeId: friendId },
                    { requesterId: friendId, addresseeId: userId },
                ],
            },
        });

        if (!friendship) {
            throw new NotFoundException('Friendship not found');
        }

        await this.prisma.friendship.delete({ where: { id: friendship.id } });
        return { success: true };
    }

    /**
     * Get list of accepted friends for a user
     */
    async getFriends(userId: string) {
        const friendships = await this.prisma.friendship.findMany({
            where: {
                status: FriendshipStatus.ACCEPTED,
                OR: [
                    { requesterId: userId },
                    { addresseeId: userId },
                ],
            },
            include: {
                requester: {
                    select: { id: true, username: true, avatarUrl: true, mmr: true },
                },
                addressee: {
                    select: { id: true, username: true, avatarUrl: true, mmr: true },
                },
            },
        });

        // Return the "other" user in each friendship
        return friendships.map((f) => {
            const friend = f.requesterId === userId ? f.addressee : f.requester;
            return {
                ...friend,
                friendshipId: f.id,
            };
        });
    }

    /**
     * Get pending friend requests received by a user
     */
    async getPendingRequests(userId: string) {
        return this.prisma.friendship.findMany({
            where: {
                addresseeId: userId,
                status: FriendshipStatus.PENDING,
            },
            include: {
                requester: {
                    select: { id: true, username: true, avatarUrl: true, mmr: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get all accepted friend user IDs for a given user
     * Used by WebSocket gateway for presence notifications
     */
    async getFriendIds(userId: string): Promise<string[]> {
        const friendships = await this.prisma.friendship.findMany({
            where: {
                status: FriendshipStatus.ACCEPTED,
                OR: [
                    { requesterId: userId },
                    { addresseeId: userId },
                ],
            },
            select: {
                requesterId: true,
                addresseeId: true,
            },
        });

        return friendships.map((f) =>
            f.requesterId === userId ? f.addresseeId : f.requesterId,
        );
    }
}
