import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '@ai-board/shared';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';
import { AccessControlService, BoardAccess, WorkspaceAccess } from './access-control.service';

/** Request augmented with the resolved access context for downstream handlers. */
export interface ScopedRequest {
  user?: { id: string; email: string };
  params: Record<string, string>;
  workspaceAccess?: WorkspaceAccess;
  boardAccess?: BoardAccess;
}

/**
 * Enforces `@RequirePermissions(...)`. Determines the resource scope from route
 * params by convention:
 *   - `:boardId`     → board scope (workspace role + board role)
 *   - `:workspaceId` → workspace scope
 * and resolves the caller's effective permissions before allowing the handler.
 * The resolved access object is attached to the request for reuse.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessControl: AccessControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<ScopedRequest>();
    if (!req.user) throw new UnauthorizedException();

    const boardId = req.params?.boardId;
    const workspaceId = req.params?.workspaceId;

    if (boardId) {
      const access = await this.accessControl.getBoardAccess(req.user.id, boardId);
      this.accessControl.assertPermissions(access, required);
      req.boardAccess = access;
      return true;
    }

    if (workspaceId) {
      const access = await this.accessControl.getWorkspaceAccess(req.user.id, workspaceId);
      this.accessControl.assertPermissions(access, required);
      req.workspaceAccess = access;
      return true;
    }

    // A permission was required but no resource scope was present — fail closed.
    throw new UnauthorizedException('Unable to resolve resource scope for permission check');
  }
}
