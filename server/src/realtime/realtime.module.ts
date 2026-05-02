import { Module } from '@nestjs/common';
import { WebsocketsModule } from '../websockets/websockets.module';
import { BATTLE_EVENTS_PORT } from './ports/battle-events.port';
import { FRIEND_EVENTS_PORT } from './ports/friend-events.port';
import { CLAN_EVENTS_PORT } from './ports/clan-events.port';
import { SEASON_EVENTS_PORT } from './ports/season-events.port';
import { PRESENCE_PORT } from './ports/presence.port';
import { BattleEventsGatewayAdapter } from './adapters/battle-events.gateway-adapter';
import { FriendEventsGatewayAdapter } from './adapters/friend-events.gateway-adapter';
import { ClanEventsGatewayAdapter } from './adapters/clan-events.gateway-adapter';
import { SeasonEventsGatewayAdapter } from './adapters/season-events.gateway-adapter';
import { PresenceGatewayAdapter } from './adapters/presence.gateway-adapter';

// Ports module: domain features import this to emit websocket events without
// pulling in `WebsocketsModule` directly. Each port is a narrow interface
// fronted by a thin adapter that delegates to `BattlesGateway`. Doing this
// breaks the symmetric `BattlesModule <-> WebsocketsModule` and
// `FriendsModule <-> WebsocketsModule` cycles; the only remaining cycle is
// between the gateway and the services it calls back into for socket
// commands (`useSkill`, `readyUp`), which is documented at the
// `forwardRef` site.
@Module({
    imports: [WebsocketsModule],
    providers: [
        { provide: BATTLE_EVENTS_PORT, useClass: BattleEventsGatewayAdapter },
        { provide: FRIEND_EVENTS_PORT, useClass: FriendEventsGatewayAdapter },
        { provide: CLAN_EVENTS_PORT, useClass: ClanEventsGatewayAdapter },
        { provide: SEASON_EVENTS_PORT, useClass: SeasonEventsGatewayAdapter },
        { provide: PRESENCE_PORT, useClass: PresenceGatewayAdapter },
    ],
    exports: [
        BATTLE_EVENTS_PORT,
        FRIEND_EVENTS_PORT,
        CLAN_EVENTS_PORT,
        SEASON_EVENTS_PORT,
        PRESENCE_PORT,
    ],
})
export class RealtimeModule {}
