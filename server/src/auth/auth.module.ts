import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtVerificationService } from './jwt-verification.service';

@Module({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, JwtVerificationService],
    exports: [PassportModule, JwtVerificationService],
})
export class AuthModule { }
