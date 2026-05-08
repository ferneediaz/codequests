import { Injectable } from '@nestjs/common';
import { BattlesGateway } from '../../websockets/battles.gateway';
import {
    FriendEventsPort,
    FriendRequestAcceptedPayload,
    FriendRequestCancelledPayload,
    FriendRequestDeclinedPayload,
    FriendRequestReceivedPayload,
} from '../ports/friend-events.port';

@Injectable()
export class FriendEventsGatewayAdapter implements FriendEventsPort {
    constructor(private readonly gateway: BattlesGateway) {}

    emitFriendRequestReceived(
        addresseeId: string,
        data: FriendRequestReceivedPayload,
    ): boolean {
        return this.gateway.emitFriendRequestReceived(addresseeId, data);
    }

    emitFriendRequestAccepted(
        requesterId: string,
        data: FriendRequestAcceptedPayload,
    ): boolean {
        return this.gateway.emitFriendRequestAccepted(requesterId, data);
    }

    emitFriendRequestDeclined(
        requesterId: string,
        data: FriendRequestDeclinedPayload,
    ): boolean {
        return this.gateway.emitFriendRequestDeclined(requesterId, data);
    }

    emitFriendRequestCancelled(
        addresseeId: string,
        data: FriendRequestCancelledPayload,
    ): boolean {
        return this.gateway.emitFriendRequestCancelled(addresseeId, data);
    }
}
