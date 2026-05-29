import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { Logger as PinoLogger } from 'nestjs-pino';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer } from 'ws';
import { AppModule } from './app.module';
import { APP_CONFIG } from './config/config.module';
import { Config } from './config/configuration';
import { RealtimeService } from './realtime/realtime.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 16 * 1024 * 1024 }),
    { bufferLogs: true },
  );

  // Route Nest logs through pino.
  app.useLogger(app.get(PinoLogger));

  const config = app.get<Config>(APP_CONFIG);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cookie);

  app.enableCors({
    origin: config.http.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('api', { exclude: ['health', 'health/ready', 'metrics'] });
  app.enableShutdownHooks();

  // ── Realtime (Yjs) WebSocket upgrade wiring ───────────────────────────────
  const realtime = app.get(RealtimeService);
  const wss = new WebSocketServer({ noServer: true });
  wss.on('connection', (ws, request) => realtime.handleConnection(ws, request));

  const httpServer = app.getHttpAdapter().getInstance().server;
  httpServer.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const { url = '' } = request;
    if (url === '/realtime' || url.startsWith('/realtime/') || url.startsWith('/realtime?')) {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    } else {
      socket.destroy();
    }
  });

  await app.listen({ port: config.http.port, host: config.http.host });
  const logger = app.get(PinoLogger);
  logger.log(`AI-Board API listening on http://${config.http.host}:${config.http.port}`);
}

void bootstrap();
