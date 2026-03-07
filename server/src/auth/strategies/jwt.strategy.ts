import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { importJWK, JWK } from 'jose';

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
          // Parse the JWK from environment variable
          const jwkString = configService.get<string>('JWT_JWK');
          if (!jwkString) {
            return done(new Error('JWT_JWK not configured'));
          }
          
          const jwk: JWK = JSON.parse(jwkString);
          const publicKey = await importJWK(jwk, 'ES256');
          
          // Convert to KeyObject for passport-jwt
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
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
