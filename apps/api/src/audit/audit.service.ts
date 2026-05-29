import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';

export interface AuditEntry {
  workspaceId?: string | null;
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

/** Accepts either the root client or a transaction client. */
type AuditClient = Pick<PrismaClient, 'auditLog'> | Prisma.TransactionClient;

/**
 * Append-only audit trail. Privileged mutations call `record` (optionally
 * within the same transaction as the mutation) so the log stays consistent
 * with the change it describes.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  async record(client: AuditClient, entry: AuditEntry): Promise<void> {
    try {
      await client.auditLog.create({
        data: {
          workspaceId: entry.workspaceId ?? null,
          actorId: entry.actorId ?? null,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId ?? null,
          metadata: (entry.metadata ?? {}) as object,
          ipAddress: entry.ipAddress ?? null,
        },
      });
    } catch (err) {
      // Auditing must never break the primary operation; log and move on.
      this.logger.error(`Failed to write audit log for ${entry.action}`, err as Error);
    }
  }
}
