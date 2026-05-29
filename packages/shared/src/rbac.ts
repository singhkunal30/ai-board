/**
 * Role-Based Access Control primitives shared between API and clients.
 *
 * The model has two scopes:
 *   - Workspace roles: coarse-grained membership of a workspace (a "team").
 *   - Board roles: optional per-board overrides for fine-grained sharing.
 *
 * Effective permissions = union of the permissions granted by a user's
 * workspace role and any explicit board role they hold on the target board.
 */

export const WorkspaceRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
} as const;
export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

export const BoardRole = {
  EDITOR: 'EDITOR',
  COMMENTER: 'COMMENTER',
  VIEWER: 'VIEWER',
} as const;
export type BoardRole = (typeof BoardRole)[keyof typeof BoardRole];

/**
 * Atomic permissions. Guards check these rather than roles directly so that the
 * role→permission mapping can evolve without touching every call site.
 */
export const Permission = {
  // Workspace administration
  WORKSPACE_VIEW: 'workspace:view',
  WORKSPACE_UPDATE: 'workspace:update',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_MANAGE_MEMBERS: 'workspace:manage_members',
  WORKSPACE_MANAGE_BILLING: 'workspace:manage_billing',

  // Boards
  BOARD_CREATE: 'board:create',
  BOARD_VIEW: 'board:view',
  BOARD_UPDATE: 'board:update',
  BOARD_DELETE: 'board:delete',
  BOARD_EXPORT: 'board:export',
  BOARD_SHARE: 'board:share',

  // Board content
  CONTENT_EDIT: 'content:edit',
  CONTENT_COMMENT: 'content:comment',

  // AI
  AI_USE: 'ai:use',
  AI_MANAGE_MODELS: 'ai:manage_models',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const VIEWER_PERMISSIONS: Permission[] = [
  Permission.WORKSPACE_VIEW,
  Permission.BOARD_VIEW,
];

const MEMBER_PERMISSIONS: Permission[] = [
  ...VIEWER_PERMISSIONS,
  Permission.BOARD_CREATE,
  Permission.BOARD_UPDATE,
  Permission.BOARD_EXPORT,
  Permission.BOARD_SHARE,
  Permission.CONTENT_EDIT,
  Permission.CONTENT_COMMENT,
  Permission.AI_USE,
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...MEMBER_PERMISSIONS,
  Permission.WORKSPACE_UPDATE,
  Permission.WORKSPACE_MANAGE_MEMBERS,
  Permission.BOARD_DELETE,
  Permission.AI_MANAGE_MODELS,
];

const OWNER_PERMISSIONS: Permission[] = [
  ...ADMIN_PERMISSIONS,
  Permission.WORKSPACE_DELETE,
  Permission.WORKSPACE_MANAGE_BILLING,
];

export const WORKSPACE_ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
  [WorkspaceRole.OWNER]: OWNER_PERMISSIONS,
  [WorkspaceRole.ADMIN]: ADMIN_PERMISSIONS,
  [WorkspaceRole.MEMBER]: MEMBER_PERMISSIONS,
  [WorkspaceRole.VIEWER]: VIEWER_PERMISSIONS,
};

export const BOARD_ROLE_PERMISSIONS: Record<BoardRole, readonly Permission[]> = {
  [BoardRole.EDITOR]: [
    Permission.BOARD_VIEW,
    Permission.BOARD_UPDATE,
    Permission.BOARD_EXPORT,
    Permission.CONTENT_EDIT,
    Permission.CONTENT_COMMENT,
    Permission.AI_USE,
  ],
  [BoardRole.COMMENTER]: [
    Permission.BOARD_VIEW,
    Permission.CONTENT_COMMENT,
    Permission.AI_USE,
  ],
  [BoardRole.VIEWER]: [Permission.BOARD_VIEW],
};

/** Numeric rank used to compare workspace roles (higher = more privileged). */
export const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number> = {
  [WorkspaceRole.VIEWER]: 0,
  [WorkspaceRole.MEMBER]: 1,
  [WorkspaceRole.ADMIN]: 2,
  [WorkspaceRole.OWNER]: 3,
};

export function permissionsForWorkspaceRole(role: WorkspaceRole): Set<Permission> {
  return new Set(WORKSPACE_ROLE_PERMISSIONS[role]);
}

export function permissionsForBoardRole(role: BoardRole): Set<Permission> {
  return new Set(BOARD_ROLE_PERMISSIONS[role]);
}

/**
 * Compute the effective permission set for a user on a board, given their
 * workspace role and (optionally) an explicit board role.
 */
export function effectivePermissions(
  workspaceRole: WorkspaceRole,
  boardRole?: BoardRole | null,
): Set<Permission> {
  const perms = permissionsForWorkspaceRole(workspaceRole);
  if (boardRole) {
    for (const p of permissionsForBoardRole(boardRole)) perms.add(p);
  }
  return perms;
}
