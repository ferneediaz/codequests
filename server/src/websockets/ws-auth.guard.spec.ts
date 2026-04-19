import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { WsAuthGuard } from './ws-auth.guard';
import { JwtVerificationService } from '../auth/jwt-verification.service';

describe('WsAuthGuard', () => {
    let guard: WsAuthGuard;
    let jwtVerificationService: {
        verifyToken: jest.Mock;
        verifyAndGetUser: jest.Mock;
    };

    const mockUser = {
        id: 'user-1',
        email: 'alice@test.com',
        username: 'alice',
        role: 'user',
        mmr: 1000,
        wins: 5,
        losses: 3,
        avatarUrl: null,
        clanId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const createMockWsContext = (token?: string): ExecutionContext => {
        const mockClient = {
            id: 'socket-1',
            handshake: {
                auth: token !== undefined ? { token } : {},
            },
            data: {},
            disconnect: jest.fn(),
        };

        return {
            switchToWs: () => ({
                getClient: () => mockClient,
                getData: () => ({}),
            }),
            switchToHttp: () => ({
                getRequest: () => ({}),
                getResponse: () => ({}),
            }),
            getHandler: () => jest.fn(),
            getClass: () => jest.fn(),
            getType: () => 'ws' as const,
            getArgs: () => [],
            getArgByIndex: () => null,
        } as unknown as ExecutionContext;
    };

    beforeEach(async () => {
        jwtVerificationService = {
            verifyToken: jest.fn(),
            verifyAndGetUser: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WsAuthGuard,
                {
                    provide: JwtVerificationService,
                    useValue: jwtVerificationService,
                },
            ],
        }).compile();

        guard = module.get<WsAuthGuard>(WsAuthGuard);
    });

    describe('canActivate', () => {
        it('should return false when no token is provided', async () => {
            const context = createMockWsContext(undefined);
            const result = await guard.canActivate(context);

            expect(result).toBe(false);
            expect(jwtVerificationService.verifyAndGetUser).not.toHaveBeenCalled();
        });

        it('should return false when token is empty string', async () => {
            const context = createMockWsContext('');
            const result = await guard.canActivate(context);

            expect(result).toBe(false);
            expect(jwtVerificationService.verifyAndGetUser).not.toHaveBeenCalled();
        });

        it('should return false when token is invalid', async () => {
            jwtVerificationService.verifyAndGetUser.mockResolvedValue(null);

            const context = createMockWsContext('invalid-token');
            const result = await guard.canActivate(context);

            expect(result).toBe(false);
            expect(jwtVerificationService.verifyAndGetUser).toHaveBeenCalledWith('invalid-token');
        });

        it('should return false when user is not found in database', async () => {
            jwtVerificationService.verifyAndGetUser.mockResolvedValue(null);

            const context = createMockWsContext('valid-token-no-user');
            const result = await guard.canActivate(context);

            expect(result).toBe(false);
            expect(jwtVerificationService.verifyAndGetUser).toHaveBeenCalledWith('valid-token-no-user');
        });

        it('should return true and attach user to socket data when token is valid', async () => {
            jwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);

            const context = createMockWsContext('valid-jwt-token');
            const result = await guard.canActivate(context);

            expect(result).toBe(true);
            expect(jwtVerificationService.verifyAndGetUser).toHaveBeenCalledWith('valid-jwt-token');

            // Verify user was attached to socket.data
            const client = context.switchToWs().getClient();
            expect(client.data.user).toEqual({
                id: mockUser.id,
                username: mockUser.username,
                email: mockUser.email,
                role: mockUser.role,
                mmr: mockUser.mmr,
            });
        });

        it('should return false when verifyAndGetUser throws an error', async () => {
            jwtVerificationService.verifyAndGetUser.mockRejectedValue(
                new Error('JWT_JWK not configured'),
            );

            const context = createMockWsContext('some-token');
            const result = await guard.canActivate(context);

            expect(result).toBe(false);
        });

        it('should disconnect the client when authentication fails', async () => {
            jwtVerificationService.verifyAndGetUser.mockResolvedValue(null);

            const context = createMockWsContext('bad-token');
            await guard.canActivate(context);

            const client = context.switchToWs().getClient();
            expect(client.disconnect).toHaveBeenCalled();
        });

        it('should NOT disconnect the client when authentication succeeds', async () => {
            jwtVerificationService.verifyAndGetUser.mockResolvedValue(mockUser);

            const context = createMockWsContext('good-token');
            await guard.canActivate(context);

            const client = context.switchToWs().getClient();
            expect(client.disconnect).not.toHaveBeenCalled();
        });
    });
});
