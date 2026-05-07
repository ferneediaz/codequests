import { Injectable } from '@nestjs/common';
import { BattlesGateway } from '../../websockets/battles.gateway';
import {
    AchievementEventsPort,
    AchievementUnlockedPayload,
} from '../ports/achievement-events.port';

@Injectable()
export class AchievementEventsGatewayAdapter implements AchievementEventsPort {
    constructor(private readonly gateway: BattlesGateway) {}

    emitAchievementUnlocked(
        userId: string,
        data: AchievementUnlockedPayload,
    ): void {
        this.gateway.emitAchievementUnlocked(userId, data);
    }
}
