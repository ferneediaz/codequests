import { Injectable } from '@nestjs/common';
import { BattlesGateway } from '../../websockets/battles.gateway';
import { ClanEventsPort } from '../ports/clan-events.port';

@Injectable()
export class ClanEventsGatewayAdapter implements ClanEventsPort {
    constructor(private readonly gateway: BattlesGateway) {}

    emitToClanMembers(
        memberIds: string[],
        event: string,
        data: unknown,
    ): void {
        this.gateway.emitToClanMembers(memberIds, event, data);
    }
}
