import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FriendsService } from '../friends/friends.service';
import { ChatRoomType, ConversationType } from '@prisma/client';

@Injectable()
export class ChatService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly friendsService: FriendsService,
    ) {}

    /**
     * Send a message to a chat room.
     * Validates room access before persisting.
     */
    async sendMessage(
        userId: string,
        roomType: ChatRoomType,
        roomId: string,
        content: string,
    ) {
        await this.validateRoomAccess(userId, roomType, roomId);

        const message = await this.prisma.message.create({
            data: {
                senderId: userId,
                content,
                roomType,
                roomId,
            },
            include: {
                sender: {
                    select: { id: true, username: true, avatarUrl: true },
                },
            },
        });

        return {
            id: message.id,
            senderId: message.senderId,
            senderUsername: message.sender.username,
            senderAvatarUrl: message.sender.avatarUrl,
            content: message.content,
            roomType: message.roomType,
            roomId: message.roomId,
            createdAt: message.createdAt,
        };
    }

    /**
     * Get paginated messages for a chat room (cursor-based).
     * Returns messages oldest-first with sender info.
     */
    async getMessages(
        roomType: ChatRoomType,
        roomId: string,
        cursor?: string,
        limit: number = 50,
    ) {
        // Cap limit to prevent excessive queries
        const cappedLimit = Math.min(limit, 100);

        const messages = await this.prisma.message.findMany({
            where: { roomType, roomId },
            orderBy: { createdAt: 'desc' },
            take: cappedLimit,
            ...(cursor
                ? {
                      skip: 1,
                      cursor: { id: cursor },
                  }
                : {}),
            include: {
                sender: {
                    select: { id: true, username: true, avatarUrl: true },
                },
            },
        });

        // Compute cursor before reversing — messages are desc-ordered,
        // so the last element is the oldest message in this page.
        const nextCursor = messages.length === cappedLimit
            ? messages[messages.length - 1]?.id
            : null;

        // Reverse to return oldest-first for display
        const sorted = messages.reverse();

        return {
            messages: sorted.map((m) => ({
                id: m.id,
                senderId: m.senderId,
                senderUsername: m.sender.username,
                senderAvatarUrl: m.sender.avatarUrl,
                content: m.content,
                roomType: m.roomType,
                roomId: m.roomId,
                createdAt: m.createdAt,
            })),
            nextCursor,
        };
    }

    /**
     * Create a DM conversation between two users.
     * Requires accepted friendship. Idempotent — returns existing if found.
     */
    async createConversation(userId: string, targetUserId: string) {
        if (userId === targetUserId) {
            throw new BadRequestException(
                'You cannot create a conversation with yourself',
            );
        }

        // Verify target user exists
        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, username: true, avatarUrl: true },
        });

        if (!targetUser) {
            throw new NotFoundException('User not found');
        }

        // Verify friendship
        const friendIds = await this.friendsService.getFriendIds(userId);
        if (!friendIds.includes(targetUserId)) {
            throw new BadRequestException(
                'You can only start conversations with friends',
            );
        }

        // Check for existing conversation between these two users
        const existing = await this.prisma.conversation.findFirst({
            where: {
                type: ConversationType.DM,
                participantIds: { hasEvery: [userId, targetUserId] },
            },
        });

        if (existing) {
            return this.enrichConversation(existing, userId);
        }

        // Create new conversation
        const conversation = await this.prisma.conversation.create({
            data: {
                type: ConversationType.DM,
                participantIds: [userId, targetUserId],
            },
        });

        return this.enrichConversation(conversation, userId);
    }

    /**
     * Get all conversations for a user with last message and participant info.
     */
    async getConversations(userId: string) {
        const conversations = await this.prisma.conversation.findMany({
            where: {
                participantIds: { has: userId },
            },
            orderBy: { updatedAt: 'desc' },
        });

        return Promise.all(
            conversations.map((c) => this.enrichConversation(c, userId)),
        );
    }

    /**
     * Get a single conversation by ID. Verifies user is a participant.
     */
    async getConversation(conversationId: string, userId: string) {
        const conversation = await this.prisma.conversation.findUnique({
            where: { id: conversationId },
        });

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        if (!conversation.participantIds.includes(userId)) {
            throw new ForbiddenException(
                'You are not a participant of this conversation',
            );
        }

        return this.enrichConversation(conversation, userId);
    }

    /**
     * Validate that a user has access to a room.
     * Used for both sending messages and joining rooms.
     */
    async validateRoomAccess(
        userId: string,
        roomType: ChatRoomType,
        roomId: string,
    ) {
        switch (roomType) {
            case ChatRoomType.LOBBY:
                // Any authenticated user can send to lobby
                return;

            case ChatRoomType.BATTLE: {
                // User must be a participant of the battle
                const participant =
                    await this.prisma.battleParticipant.findFirst({
                        where: { battleId: roomId, userId },
                    });
                if (!participant) {
                    throw new ForbiddenException(
                        'You are not a participant of this battle',
                    );
                }
                return;
            }

            case ChatRoomType.DM: {
                // User must be a participant of the conversation
                const conversation =
                    await this.prisma.conversation.findUnique({
                        where: { id: roomId },
                    });
                if (!conversation) {
                    throw new NotFoundException('Conversation not found');
                }
                if (!conversation.participantIds.includes(userId)) {
                    throw new ForbiddenException(
                        'You are not a participant of this conversation',
                    );
                }
                return;
            }

            default:
                throw new ForbiddenException('Unknown room type');
        }
    }

    /**
     * Enrich a conversation with participant info and last message.
     */
    private async enrichConversation(
        conversation: { id: string; type: ConversationType; participantIds: string[]; createdAt: Date },
        userId: string,
    ) {
        // Get participant info
        const participants = await this.prisma.user.findMany({
            where: { id: { in: conversation.participantIds } },
            select: { id: true, username: true, avatarUrl: true },
        });

        // Get last message
        const lastMessage = await this.prisma.message.findFirst({
            where: {
                roomType: ChatRoomType.DM,
                roomId: conversation.id,
            },
            orderBy: { createdAt: 'desc' },
            select: { content: true, senderId: true, createdAt: true },
        });

        return {
            id: conversation.id,
            type: conversation.type,
            participants,
            lastMessage: lastMessage || undefined,
            createdAt: conversation.createdAt,
        };
    }
}
