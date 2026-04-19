import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
import { createPublicKey, KeyObject } from 'crypto';

export interface JwtPayload {
    sub: string;
    email: string;
    aud: string;
    role: string;
    exp?: number;
    iat?: number;
}

export interface VerifiedUser {
    id: string;
    email: string;
    username: string;
    role: string;
    mmr: number;
    [key: string]: any;
}

@Injectable()
export class JwtVerificationService {
    private readonly logger = new Logger(JwtVerificationService.name);
    private publicKey: KeyObject | null = null;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * Get or create the public key from the JWK config.
     */
    private getPublicKey(): KeyObject {
        if (this.publicKey) return this.publicKey;

        const jwkString = this.configService.get<string>('JWT_JWK');
        if (!jwkString) {
            throw new Error('JWT_JWK not configured');
        }

        const jwk = JSON.parse(jwkString);
        this.publicKey = createPublicKey({ key: jwk, format: 'jwk' });
        return this.publicKey;
    }

    /**
     * Verify a JWT token and return the decoded payload.
     * Returns null if verification fails.
     */
    verifyToken(token: string): JwtPayload | null {
        try {
            const publicKey = this.getPublicKey();
            const decoded = jwt.verify(token, publicKey, {
                algorithms: ['ES256'],
            }) as JwtPayload;
            return decoded;
        } catch (error) {
            this.logger.warn(`Token verification failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Verify a token and look up the user in the database.
     * Returns the user if found, null otherwise.
     */
    async verifyAndGetUser(token: string): Promise<VerifiedUser | null> {
        const payload = this.verifyToken(token);
        if (!payload) return null;

        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
        });

        if (user) return user;

        // Return minimal user info from token if not in DB
        return null;
    }
}
