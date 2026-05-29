import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import {
  AccessTokenPayload,
  AuthTokens,
  RefreshTokenPayload,
} from '@ai-board/shared';
import { APP_CONFIG } from '../config/config.module';
import { Config } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';

export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Owns the lifecycle of JWT access/refresh tokens and their backing sessions.
 *
 * Access tokens are short-lived and stateless. Refresh tokens are long-lived
 * but bound to a DB `Session` row (`jti = session.id`); the raw refresh token
 * is never stored — only an argon2 hash — and is rotated on every use so a
 * leaked-then-replayed token is detectable and the chain can be cut.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: Config,
  ) {}

  async issueTokens(
    user: { id: string; email: string },
    ctx: SessionContext = {},
  ): Promise<AuthTokens> {
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: 'pending',
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        expiresAt: new Date(Date.now() + this.config.jwt.refreshTtl * 1000),
      },
    });

    const tokens = await this.signPair(user, session.id);
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: await argon2.hash(tokens.refreshToken) },
    });
    return tokens;
  }

  /** Validates a refresh token, rotates its session, and returns a fresh pair. */
  async rotate(refreshToken: string, ctx: SessionContext = {}): Promise<AuthTokens> {
    const payload = await this.verifyRefresh(refreshToken);
    const session = await this.prisma.session.findUnique({ where: { id: payload.jti } });

    if (
      !session ||
      session.revokedAt ||
      session.userId !== payload.sub ||
      session.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matches = await argon2.verify(session.refreshTokenHash, refreshToken);
    if (!matches) {
      // Token reuse / theft: revoke the whole session defensively.
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid refresh token');

    // Rotate: revoke the old session, mint a new one.
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens({ id: user.id, email: user.email }, ctx);
  }

  /** Revokes the session behind a refresh token (logout). Best-effort. */
  async revoke(refreshToken: string): Promise<void> {
    try {
      const payload = await this.verifyRefresh(refreshToken);
      await this.prisma.session.updateMany({
        where: { id: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Already invalid — nothing to revoke.
    }
  }

  async verifyAccess(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.jwt.accessSecret,
      });
      if (payload.type !== 'access') throw new Error('wrong token type');
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private async verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.jwt.refreshSecret,
      });
      if (payload.type !== 'refresh') throw new Error('wrong token type');
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async signPair(
    user: { id: string; email: string },
    sessionId: string,
  ): Promise<AuthTokens> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      type: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      jti: sessionId,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.jwt.accessSecret,
        expiresIn: this.config.jwt.accessTtl,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.jwt.refreshSecret,
        expiresIn: this.config.jwt.refreshTtl,
      }),
    ]);

    return { accessToken, refreshToken, expiresIn: this.config.jwt.accessTtl };
  }
}
