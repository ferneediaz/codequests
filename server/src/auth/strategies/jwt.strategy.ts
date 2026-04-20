import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { createPublicKey } from 'crypto';

// This is the payload structure from Supabase JWT tokens
interface JwtPayload {
  sub: string; // User ID
  email: string;
  aud: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['ES256'], // Supabase uses ES256
      secretOrKeyProvider: async (
        _request: any,
        _rawJwtToken: string,
        done: (err: any, secretOrKey?: string | Buffer) => void,
      ) => {
        try {
          const jwkString = configService.get<string>('JWT_JWK');
          if (!jwkString) {
            return done(new Error('JWT_JWK not configured'));
          }
          
          const jwk = JSON.parse(jwkString);
          // Convert JWK to Node.js KeyObject (which passport-jwt understands)
          const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
          
          done(null, publicKey as any);
        } catch (error) {
          done(error);
        }
      },
    });
  }

  /**
   * This method is called after JWT is verified.
   * We look up the user in our database and return it.
   * The returned object is attached to request.user
   */
  async validate(payload: JwtPayload) {
    // Try to find user in our database
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    // If user exists in our DB, return the full user object with sub alias
    if (user) {
      return { ...user, sub: user.id };
    }

    // If user doesn't exist yet (first login, hasn't called /auth/sync),
    // return the JWT payload so /auth/sync can create them
    return {
      id: payload.sub,
      sub: payload.sub,
      email: payload.email,
      role: payload.role || 'user',
    };
  }
}
