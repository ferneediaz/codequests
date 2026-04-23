import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Inject,
    forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BattlesGateway } from '../websockets/battles.gateway';
import { BattlesService } from '../battles/battles.service';
import { FriendsService } from '../friends/friends.service';
import { BattleMode, FriendshipStatus } from '@prisma/client';
import type {
    LobbyFriendship,
    LobbySnapshotDto,
    LobbyUserDto,
    LobbyClanDto,
} from './dto/lobby-snapshot.dto';

/**
 * LobbyService powers the global "online lobby" surface where users can see
 * who else is online, discover clans, and launch social actions (friend
 * request, DM, challenge) without being inside an active battle.
 *
 * Presence is sourced from `BattlesGateway.userSocketMap`, which is the
 * canonical "is this user connected right now" state. Clan and friendship
 * metadata is enriched from Prisma so the UI can render the correct CTA per
 * row (Add Friend vs Accept Request vs Challenge).
 */
@Injectable()
export class LobbyService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(forwardRef(() => BattlesGateway))
        private readonly battlesGateway: BattlesGateway,
        private readonly battlesService: BattlesService,
        private readonly friendsService: FriendsService,
    ) {}

    /**
     * Build a full lobby snapshot for the requesting user. Used by the
     * frontend on mount to hydrate both lists before subscribing to realtime
     * deltas. Self is excluded from the user list (it's implicit).
     */
    async getSnapshot(userId: string): Promise<LobbySnapshotDto> {
        const onlineUserIds = Array.from(this.getOnlineUserIdSet());

        if (onlineUserIds.length === 0) {
            return { users: [], clans: [], onlineCount: 0 };
        }

        const users = await this.prisma.user.findMany({
            where: { id: { in: onlineUserIds } },
            select: {
                id: true,
                username: true,
                avatarUrl: true,
                mmr: true,
                clan: {
                    select: { id: true, name: true, tag: true, mmr: true },
                },
            },
            orderBy: { mmr: 'desc' },
        });

        // Friendship state — fetch everything once and index by other-user-id.
        const friendships = await this.prisma.friendship.findMany({
            where: {
                OR: [{ requesterId: userId }, { addresseeId: userId }],
                status: {
                    in: [FriendshipStatus.PENDING, FriendshipStatus.ACCEPTED],
                },
            },
            select: {
                id: true,
                requesterId: true,
                addresseeId: true,
                status: true,
            },
        });

        const friendshipByOther = new Map<
            string,
            { id: string; status: LobbyFriendship }
        >();
        for (const f of friendships) {
            const isRequester = f.requesterId === userId;
            const otherId = isRequester ? f.addresseeId : f.requesterId;
            let status: LobbyFriendship;
            if (f.status === FriendshipStatus.ACCEPTED) {
                status = 'ACCEPTED';
            } else if (isRequester) {
                status = 'PENDING_OUT';
            } else {
                status = 'PENDING_IN';
            }
            friendshipByOther.set(otherId, { id: f.id, status });
        }

        const userDtos: LobbyUserDto[] = users
            .filter((u) => u.id !== userId)
            .map((u) => {
                const rel = friendshipByOther.get(u.id);
                return {
                    id: u.id,
                    username: u.username,
                    avatarUrl: u.avatarUrl,
                    mmr: u.mmr,
                    clan: u.clan,
                    friendship: rel?.status ?? 'NONE',
                    friendshipId: rel?.id ?? null,
                };
            });

        // Clan summaries — group online users by clanId and join clan rows.
        const clans = await this.buildOnlineClanList(onlineUserIds);

        return {
            users: userDtos,
            clans,
            onlineCount: onlineUserIds.length,
        };
    }

    /**
     * Send a friend request by target user ID (vs the existing username-based
     * endpoint, which is still available). Returns normalized friendship row
     * shape matching the rest of the friends API.
     */
    async sendFriendRequestById(userId: string, targetUserId: string) {
        if (userId === targetUserId) {
            throw new BadRequestException(
                'You cannot send a friend request to yourself',
            );
        }

        const target = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            select: { username: true },
        });

        if (!target) {
            throw new NotFoundException('User not found');
        }

        return this.friendsService.sendRequest(userId, target.username);
    }

    /**
     * Create a 1v1 battle with an invite code and notify the target player.
     * The inviter navigates to the battle lobby; the target receives a
     * standard `battle.invite_received` toast via the existing invite flow.
     */
    async challengeUser(
        inviterUserId: string,
        targetUserId: string,
        timeLimitMinutes?: number,
    ) {
        if (inviterUserId === targetUserId) {
            throw new BadRequestException('You cannot challenge yourself');
        }

        const target = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, username: true },
        });

        if (!target) {
            throw new NotFoundException('Target user not found');
        }

        if (!this.battlesGateway.isOnline(target.id)) {
            throw new BadRequestException(
                'That user is offline. Try sending a friend request instead.',
            );
        }

        // Create a fresh 1v1 battle with an invite code so the target can
        // accept via the standard invite-join flow.
        const battle = await this.battlesService.createBattle(inviterUserId, {
            mode: BattleMode.ONE_V_ONE,
            withInviteCode: true,
            timeLimitMinutes: timeLimitMinutes ?? 5,
        });

        // Deliver the invite to the target's battles socket (if any) so the
        // existing `useInviteNotifications` hook renders the Accept/Decline
        // toast for them.
        const inviteData = await this.battlesService.inviteUserToBattle(
            battle.id,
            inviterUserId,
            target.username,
        );

        const targetSocket = this.battlesGateway.getSocketByUserId(
            inviteData.targetUserId,
        );
        if (targetSocket) {
            targetSocket.emit('battle.invite_received', {
                battleId: inviteData.battleId,
                inviterUsername: inviteData.inviterUsername,
                inviterAvatarUrl: inviteData.inviterAvatarUrl,
                battleMode: inviteData.battleMode,
                inviteCode: inviteData.inviteCode,
            });
        }

        return {
            battleId: battle.id,
            inviteCode: battle.inviteCode,
            delivered: !!targetSocket,
        };
    }

    /**
     * Peek into the gateway's user->socket map. We can't access it directly,
     * so we iterate connected sockets and collect userIds from their auth
     * payload. This is O(N) in current connection count, which matches the
     * gateway's own presence implementation.
     */
    private getOnlineUserIdSet(): Set<string> {
        const ids = new Set<string>();
        for (const socket of this.battlesGateway.getConnectedClients().values()) {
            const uid = socket.data?.user?.id;
            if (uid) ids.add(uid);
        }
        return ids;
    }

    /**
     * Build the "online clans" list by grouping online users by clanId and
     * enriching with the clan row (name/tag/mmr/memberCount).
     */
    private async buildOnlineClanList(
        onlineUserIds: string[],
    ): Promise<LobbyClanDto[]> {
        if (onlineUserIds.length === 0) return [];

        // Find clan IDs that have at least one online member.
        const grouped = await this.prisma.user.groupBy({
            by: ['clanId'],
            where: {
                id: { in: onlineUserIds },
                clanId: { not: null },
            },
            _count: { _all: true },
        });

        const clanIds = grouped
            .map((g) => g.clanId)
            .filter((id): id is string => !!id);

        if (clanIds.length === 0) return [];

        const clans = await this.prisma.clan.findMany({
            where: { id: { in: clanIds } },
            select: {
                id: true,
                name: true,
                tag: true,
                mmr: true,
                _count: { select: { members: true } },
            },
        });

        const onlineCountByClan = new Map<string, number>();
        for (const g of grouped) {
            if (g.clanId) onlineCountByClan.set(g.clanId, g._count._all);
        }

        return clans
            .map((c) => ({
                id: c.id,
                name: c.name,
                tag: c.tag,
                mmr: c.mmr,
                memberCount: c._count.members,
                onlineCount: onlineCountByClan.get(c.id) ?? 0,
            }))
            .sort((a, b) => b.onlineCount - a.onlineCount || b.mmr - a.mmr);
    }
}
