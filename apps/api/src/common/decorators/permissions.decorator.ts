import { SetMetadata } from '@nestjs/common';
import { Permission } from '@ai-board/shared';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Declares the permissions required to invoke a route. Enforced by
 * `PermissionsGuard`, which resolves the caller's effective permissions for the
 * workspace/board referenced in the request.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
