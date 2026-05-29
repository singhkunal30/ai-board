import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { BoardAccess, WorkspaceAccess } from './access-control.service';
import { ScopedRequest } from './permissions.guard';

/** Injects the WorkspaceAccess resolved by PermissionsGuard. */
export const WorkspaceCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceAccess | undefined =>
    ctx.switchToHttp().getRequest<ScopedRequest>().workspaceAccess,
);

/** Injects the BoardAccess resolved by PermissionsGuard. */
export const BoardCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BoardAccess | undefined =>
    ctx.switchToHttp().getRequest<ScopedRequest>().boardAccess,
);
