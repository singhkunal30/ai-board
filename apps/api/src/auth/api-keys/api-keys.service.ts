import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { customAlphabet } from 'nanoid';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const makePrefix = customAlphabet(alphabet, 10);
const makeSecret = customAlphabet(alphabet, 36);

export interface CreatedApiKey {
  id: string;
  name: string;
  prefix: string;
  /** Full plaintext token — shown ONCE, never stored. */
  token: string;
  createdAt: Date;
  expiresAt: Date | null;
}

/**
 * Personal access tokens for non-interactive clients (the MCP server, CI,
 * integrations). Token format: `aib_<prefix>_<secret>`. Only an argon2 hash of
 * the secret is stored; the indexed prefix narrows lookup before verification.
 */
@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, name: string, expiresInDays?: number): Promise<CreatedApiKey> {
    const prefix = makePrefix();
    const secret = makeSecret();
    const keyHash = await argon2.hash(secret, { type: argon2.argon2id });
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const row = await this.prisma.apiKey.create({
      data: { userId, name, prefix, keyHash, expiresAt },
    });

    return {
      id: row.id,
      name: row.name,
      prefix,
      token: `aib_${prefix}_${secret}`,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  }

  list(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(userId: string, id: string): Promise<void> {
    const key = await this.prisma.apiKey.findFirst({ where: { id, userId } });
    if (!key) throw new NotFoundException('API key not found');
    await this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  /** Validate a presented token; returns the owning user or null. */
  async validate(token: string): Promise<AuthUser | null> {
    const parts = token.split('_');
    if (parts.length !== 3 || parts[0] !== 'aib') return null;
    const [, prefix, secret] = parts;

    const key = await this.prisma.apiKey.findUnique({
      where: { prefix },
      include: { user: { select: { id: true, email: true, isActive: true } } },
    });
    if (!key || key.revokedAt || !key.user.isActive) return null;
    if (key.expiresAt && key.expiresAt.getTime() < Date.now()) return null;

    const ok = await argon2.verify(key.keyHash, secret).catch(() => false);
    if (!ok) return null;

    // Best-effort usage timestamp; never blocks the request.
    void this.prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    return { id: key.user.id, email: key.user.email };
  }
}
