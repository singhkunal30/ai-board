import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * End-to-end happy path against a real database. Requires DATABASE_URL to point
 * at a migrated Postgres (CI provides a pgvector service). Runs with the mock
 * AI provider so no LLM runtime is needed.
 */
describe('AI-Board API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'supersecret-e2e-123';
  let accessToken: string;
  let workspaceId: string;
  let boardId: string;

  beforeAll(async () => {
    process.env.AI_PROVIDER = 'mock';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api', { exclude: ['health', 'health/ready', 'metrics'] });
    await app.init();
    await (app as NestFastifyApplication).getHttpAdapter().getInstance().ready();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registers a user and bootstraps a default workspace', async () => {
    const res = await request(server)
      .post('/api/auth/register')
      .send({ email, password, name: 'E2E User' })
      .expect(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.tokens.accessToken).toBeDefined();
    accessToken = res.body.tokens.accessToken;
  });

  it('rejects unauthenticated access', async () => {
    await request(server).get('/api/users/me').expect(401);
  });

  it('returns the current user', async () => {
    const res = await request(server)
      .get('/api/users/me')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.email).toBe(email);
  });

  it('lists the auto-created workspace', async () => {
    const res = await request(server)
      .get('/api/workspaces')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    workspaceId = res.body[0].id;
  });

  it('creates a board from a template', async () => {
    const res = await request(server)
      .post(`/api/workspaces/${workspaceId}/boards`)
      .set('authorization', `Bearer ${accessToken}`)
      .send({ title: 'E2E Board', templateId: 'retro' })
      .expect(201);
    boardId = res.body.id;
    expect(res.body.snapshot.objects.length).toBeGreaterThan(0);
  });

  it('generates a mind map onto the board', async () => {
    const res = await request(server)
      .post(`/api/boards/${boardId}/ai/mindmap`)
      .set('authorization', `Bearer ${accessToken}`)
      .send({ prompt: 'launch plan' })
      .expect(201);
    expect(res.body.objects.length).toBeGreaterThan(0);
  });

  it('answers a RAG board chat with sources', async () => {
    const res = await request(server)
      .post(`/api/boards/${boardId}/ai/chat`)
      .set('authorization', `Bearer ${accessToken}`)
      .send({ message: 'what is here?' })
      .expect(201);
    expect(res.body.answer).toBeDefined();
    expect(Array.isArray(res.body.sources)).toBe(true);
  });

  it('enforces validation on bad input', async () => {
    await request(server)
      .post(`/api/workspaces/${workspaceId}/boards`)
      .set('authorization', `Bearer ${accessToken}`)
      .send({ title: '' })
      .expect(400);
  });

  it('exposes health and metrics', async () => {
    await request(server).get('/health').expect(200);
    await request(server).get('/metrics').expect(200);
  });
});
