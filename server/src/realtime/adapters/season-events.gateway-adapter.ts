import { Injectable } from '@nestjs/common';
import { BattlesGateway } from '../../websockets/battles.gateway';
import {
    SeasonEndedPayload,
    SeasonEventsPort,
} from '../ports/season-events.port';

@Injectable()
export class SeasonEventsGatewayAdapter implements SeasonEventsPort {
    constructor(private readonly gateway: BattlesGateway) {}

    emitSeasonEnded(data: SeasonEndedPayload): void {
        this.gateway.emitSeasonEnded(data);
    }
}
