import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
    Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FriendshipStatus } from '@prisma/client';
import {
    FRIEND_EVENTS_PORT,
    FriendEventsPort,
} from '../realtime/ports/friend-events.port';

@Injectable()
export class FriendsService {
    constructor(
        private readonly prisma: PrismaService,
        // Realtime is best-effort delivery; all paths tolerate the port
        // failing to deliver. The port replaces a previous direct gateway
        // injection that caused the FriendsModule <-> WebsocketsModule
        // cycle (now broken by RealtimeModule).
        @Inject(FRIEND_EVENTS_PORT)
        private readonly friendEvents: FriendEventsPort,
    ) {}

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
            const created = await this.prisma.$transaction(async (tx) => {
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
            await this.notifyRequestReceived(created.id, requesterId, addressee.id, created.createdAt);
            return created;
        }

        const created = await this.prisma.friendship.create({
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
        await this.notifyRequestReceived(created.id, requesterId, addressee.id, created.createdAt);
        return created;
    }

    /**
     * Best-effort realtime push to the addressee when a new pending
     * request lands. Loads the requester's public profile to enrich the
     * socket payload so the recipient UI can render a full row without a
     * follow-up fetch.
     */
    private async notifyRequestReceived(
        friendshipId: string,
        requesterId: string,
        addresseeId: string,
        createdAt: Date,
    ) {
        try {
            const requester = await this.prisma.user.findUnique({
                where: { id: requesterId },
                select: { id: true, username: true, avatarUrl: true, mmr: true },
            });
            if (!requester) return;
            this.friendEvents.emitFriendRequestReceived(addresseeId, {
                friendshipId,
                requesterId: requester.id,
                requesterUsername: requester.username,
                requesterAvatarUrl: requester.avatarUrl,
                requesterMmr: requester.mmr,
                createdAt,
            });
        } catch {
            // Realtime delivery is best-effort — REST hydration covers the gap.
        }
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

        const updated = await this.prisma.friendship.update({
            where: { id: friendshipId },
            data: { status: FriendshipStatus.ACCEPTED },
            include: {
                requester: {
                    select: { id: true, username: true, avatarUrl: true, mmr: true },
                },
                addressee: {
                    select: { id: true, username: true, avatarUrl: true, mmr: true },
                },
            },
        });

        // Let the original requester know in realtime that they now have
        // a new friend (socket-only; REST is unchanged).
        try {
            this.friendEvents.emitFriendRequestAccepted(updated.requesterId, {
                friendshipId: updated.id,
                friendId: updated.addressee.id,
                friendUsername: updated.addressee.username,
                friendAvatarUrl: updated.addressee.avatarUrl,
                friendMmr: updated.addressee.mmr,
            });
        } catch {
            // best-effort
        }

        return updated;
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

        const updated = await this.prisma.friendship.update({
            where: { id: friendshipId },
            data: { status: FriendshipStatus.DECLINED },
            include: {
                addressee: {
                    select: { id: true, username: true },
                },
            },
        });

        // Best-effort: quietly let the requester know their request was
        // declined. Client surfaces this as a subtle toast, not a badge.
        try {
            this.friendEvents.emitFriendRequestDeclined(updated.requesterId, {
                friendshipId: updated.id,
                addresseeId: updated.addressee.id,
                addresseeUsername: updated.addressee.username,
            });
        } catch {
            // best-effort
        }

        return updated;
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
     * Get pending friend requests sent by a user.
     */
    async getSentRequests(userId: string) {
        return this.prisma.friendship.findMany({
            where: {
                requesterId: userId,
                status: FriendshipStatus.PENDING,
            },
            include: {
                addressee: {
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
