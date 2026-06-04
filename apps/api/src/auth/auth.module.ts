import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { TokenService } from './token.service';
import { ApiKeysController } from './api-keys/api-keys.controller';
import { ApiKeysService } from './api-keys/api-keys.service';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    // Secrets are supplied per-operation in TokenService/JwtStrategy so access
    // and refresh tokens can use independent signing keys.
    JwtModule.register({}),
  ],
  controllers: [AuthController, ApiKeysController],
  providers: [AuthService, TokenService, JwtStrategy, ApiKeysService],
  exports: [AuthService, TokenService, ApiKeysService],
})
export class AuthModule {}
