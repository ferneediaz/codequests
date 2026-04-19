import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtVerificationService } from '../auth/jwt-verification.service';

@Injectable()
export class WsAuthGuard implements CanActivate {
    private readonly logger = new Logger(WsAuthGuard.name);

    constructor(
        private readonly jwtVerificationService: JwtVerificationService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const client = context.switchToWs().getClient();
        const token = client.handshake?.auth?.token;

        if (!token) {
            this.logger.warn(`WS connection rejected: No token (${client.id})`);
            client.disconnect();
            return false;
        }

        try {
            const user = await this.jwtVerificationService.verifyAndGetUser(token);

            if (!user) {
                this.logger.warn(`WS connection rejected: Invalid token or user not found (${client.id})`);
                client.disconnect();
                return false;
            }

            // Attach user to socket data for downstream access
            client.data.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                mmr: user.mmr,
            };

            return true;
        } catch (error) {
            this.logger.error(`WS auth error: ${error.message}`);
            client.disconnect();
            return false;
        }
    }
}
