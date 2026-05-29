import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { customAlphabet } from 'nanoid';
import {
  AuthTokens,
  LoginInput,
  PublicUser,
  RegisterInput,
  WorkspaceRole,
} from '@ai-board/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SessionContext, TokenService } from './token.service';

const slugId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);

export interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterInput, ctx: SessionContext): Promise<AuthResult> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });

    // Create the user and a default workspace they own, atomically.
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: input.email.toLowerCase(), name: input.name, passwordHash },
      });
      const workspace = await tx.workspace.create({
        data: {
          name: `${input.name}'s Workspace`,
          slug: `${slugify(input.name)}-${slugId()}`,
          ownerId: created.id,
        },
      });
      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: created.id, role: WorkspaceRole.OWNER },
      });
      await tx.auditLog.create({
        data: {
          workspaceId: workspace.id,
          actorId: created.id,
          action: 'user.register',
          targetType: 'user',
          targetId: created.id,
          ipAddress: ctx.ipAddress,
        },
      });
      return created;
    });

    const tokens = await this.tokens.issueTokens({ id: user.id, email: user.email }, ctx);
    return { user: UsersService.toPublic(user), tokens };
  }

  async login(input: LoginInput, ctx: SessionContext): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    // Constant-ish failure path: still hash to reduce user-enumeration timing.
    if (!user || !user.passwordHash || !user.isActive) {
      await argon2.hash(input.password).catch(() => undefined);
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    await this.users.markLogin(user.id);
    const tokens = await this.tokens.issueTokens({ id: user.id, email: user.email }, ctx);
    return { user: UsersService.toPublic(user), tokens };
  }

  refresh(refreshToken: string, ctx: SessionContext): Promise<AuthTokens> {
    return this.tokens.rotate(refreshToken, ctx);
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'workspace'
  );
}
