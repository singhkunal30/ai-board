import { ForbiddenException } from '@nestjs/common';
import { BoardRole, Permission, WorkspaceRole, effectivePermissions } from '@ai-board/shared';
import { AccessControlService } from './access-control.service';

describe('RBAC effective permissions', () => {
  it('grants viewers read-only access', () => {
    const perms = effectivePermissions(WorkspaceRole.VIEWER);
    expect(perms.has(Permission.BOARD_VIEW)).toBe(true);
    expect(perms.has(Permission.CONTENT_EDIT)).toBe(false);
    expect(perms.has(Permission.WORKSPACE_DELETE)).toBe(false);
  });

  it('lets members edit content and use AI', () => {
    const perms = effectivePermissions(WorkspaceRole.MEMBER);
    expect(perms.has(Permission.CONTENT_EDIT)).toBe(true);
    expect(perms.has(Permission.AI_USE)).toBe(true);
    expect(perms.has(Permission.WORKSPACE_MANAGE_MEMBERS)).toBe(false);
  });

  it('gives owners every workspace power', () => {
    const perms = effectivePermissions(WorkspaceRole.OWNER);
    expect(perms.has(Permission.WORKSPACE_DELETE)).toBe(true);
    expect(perms.has(Permission.WORKSPACE_MANAGE_BILLING)).toBe(true);
  });

  it('elevates a workspace viewer to editor via a board grant', () => {
    const perms = effectivePermissions(WorkspaceRole.VIEWER, BoardRole.EDITOR);
    expect(perms.has(Permission.CONTENT_EDIT)).toBe(true);
    // ...but only on that board — no workspace-wide powers leak in.
    expect(perms.has(Permission.WORKSPACE_UPDATE)).toBe(false);
  });
});

describe('AccessControlService.assertPermissions', () => {
  const svc = new AccessControlService({} as never);

  it('passes when all required permissions are present', () => {
    const access = { permissions: new Set([Permission.BOARD_VIEW, Permission.CONTENT_EDIT]) };
    expect(() => svc.assertPermissions(access, [Permission.BOARD_VIEW])).not.toThrow();
  });

  it('throws Forbidden listing the missing permissions', () => {
    const access = { permissions: new Set([Permission.BOARD_VIEW]) };
    expect(() => svc.assertPermissions(access, [Permission.CONTENT_EDIT])).toThrow(
      ForbiddenException,
    );
  });
});
