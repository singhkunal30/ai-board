import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Server } from '@hocuspocus/server';
import type { Hocuspocus } from '@hocuspocus/server';
import * as Y from 'yjs';
import { Permission } from '@ai-board/shared';
import { APP_CONFIG } from '../config/config.module';
import { Config } from '../config/configuration';
import { AccessControlService } from '../authz/access-control.service';
import { TokenService } from '../auth/token.service';
import { PrismaService } from '../prisma/prisma.service';

interface ConnectionContext {
  userId: string;
}

/**
 * Hocuspocus-backed Yjs collaboration server.
 *
 *  - Auth: the client sends its JWT access token; we verify it and resolve the
 *    caller's board permissions. No BOARD_VIEW → connection rejected.
 *    No CONTENT_EDIT → connection forced read-only.
 *  - Persistence: the board's CRDT state is loaded from / written back to
 *    Postgres (`Board.yDocState`), debounced so bursts of edits don't thrash
 *    the database.
 *
 * The document name on the wire is the board id.
 */
@Injectable()
export class RealtimeService implements OnModuleInit {
  private readonly logger = new Logger(RealtimeService.name);
  private server!: Hocuspocus;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly accessControl: AccessControlService,
    @Inject(APP_CONFIG) private readonly config: Config,
  ) {}

  onModuleInit(): void {
    this.server = Server.configure({
      name: 'ai-board-realtime',
      // 2s debounce, flush at most every 10s under sustained editing.
      debounce: 2_000,
      maxDebounce: 10_000,

      onAuthenticate: async (data): Promise<ConnectionContext> => {
        const payload = await this.tokens.verifyAccess(data.token);
        const boardId = data.documentName;
        const access = await this.accessControl.getBoardAccess(payload.sub, boardId);

        if (!access.permissions.has(Permission.BOARD_VIEW)) {
          throw new Error('Forbidden');
        }
        if (!access.permissions.has(Permission.CONTENT_EDIT)) {
          data.connection.readOnly = true;
        }
        return { userId: payload.sub };
      },

      onLoadDocument: async (data): Promise<Y.Doc> => {
        const board = await this.prisma.board.findUnique({
          where: { id: data.documentName },
          select: { yDocState: true },
        });
        if (board?.yDocState) {
          Y.applyUpdate(data.document, new Uint8Array(board.yDocState));
        }
        return data.document;
      },

      onStoreDocument: async (data): Promise<void> => {
        const state = Buffer.from(Y.encodeStateAsUpdate(data.document));
        await this.prisma.board.update({
          where: { id: data.documentName },
          data: { yDocState: state, version: { increment: 1 } },
        });
      },
    });

    this.logger.log('Realtime (Yjs/Hocuspocus) server configured');
  }

  /** Hand a freshly-upgraded WebSocket to Hocuspocus. */
  handleConnection(websocket: unknown, request: unknown): void {
    // Cast at the boundary: ws/http types differ across versions but are
    // structurally compatible with Hocuspocus's expectations.
    this.server.handleConnection(websocket as never, request as never);
  }
}
