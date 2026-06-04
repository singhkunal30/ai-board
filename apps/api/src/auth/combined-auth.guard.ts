import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ApiKeysService } from './api-keys/api-keys.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Global authentication guard accepting either a JWT access token (interactive
 * clients) or an API key (non-interactive clients such as the MCP server).
 *
 * API keys are presented as `X-API-Key: aib_...` or `Authorization: Bearer aib_...`.
 * Anything else falls through to the JWT guard (which also honors `@Public()`).
 */
@Injectable()
export class CombinedAuthGuard implements CanActivate {
  private readonly jwtGuard: JwtAuthGuard;

  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeys: ApiKeysService,
  ) {
    this.jwtGuard = new JwtAuthGuard(reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FastifyRequest & { user?: unknown }>();
    const token = this.extractApiKey(req);

    if (token) {
      const user = await this.apiKeys.validate(token);
      if (!user) throw new UnauthorizedException('Invalid API key');
      (req as { user?: unknown }).user = user;
      return true;
    }

    return (await this.jwtGuard.canActivate(context)) as boolean;
  }

  private extractApiKey(req: FastifyRequest): string | null {
    const headerKey = req.headers['x-api-key'];
    if (typeof headerKey === 'string' && headerKey.startsWith('aib_')) return headerKey;
    const auth = req.headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer aib_')) return auth.slice(7);
    return null;
  }
}
