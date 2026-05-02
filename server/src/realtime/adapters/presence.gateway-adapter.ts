import { Injectable } from '@nestjs/common';
import { BattlesGateway } from '../../websockets/battles.gateway';
import { PresencePort } from '../ports/presence.port';

@Injectable()
export class PresenceGatewayAdapter implements PresencePort {
    constructor(private readonly gateway: BattlesGateway) {}

    isOnline(userId: string): boolean {
        return this.gateway.isOnline(userId);
    }

    getOnlineUserIds(): string[] {
        const ids = new Set<string>();
        for (const socket of this.gateway.getConnectedClients().values()) {
            const uid = socket.data?.user?.id;
            if (uid) ids.add(uid);
        }
        return Array.from(ids);
    }

    emitToUser(userId: string, event: string, payload: unknown): boolean {
        const socket = this.gateway.getSocketByUserId(userId);
        if (!socket) return false;
        socket.emit(event, payload);
        return true;
    }
}
