import { z } from 'zod';

/**
 * Environment schema. Validated once at boot — the process refuses to start
 * with a misconfigured environment rather than failing lazily at runtime.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().url(),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Storage driver: 's3' (MinIO / any S3-compatible) or 'filesystem' (local dev).
  STORAGE_DRIVER: z.enum(['s3', 'filesystem']).default('s3'),
  STORAGE_LOCAL_DIR: z.string().default('./.storage'),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('ai-board'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2592000),

  AI_PROVIDER: z.enum(['ollama', 'openai-compatible', 'mock']).default('ollama'),
  AI_BASE_URL: z.string().default('http://localhost:11434'),
  AI_API_KEY: z.string().optional().default(''),
  AI_DEFAULT_CHAT_MODEL: z.string().default('qwen2.5:7b-instruct'),
  AI_DEFAULT_EMBEDDING_MODEL: z.string().default('nomic-embed-text'),
  AI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  METRICS_ENABLED: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

/** Structured, strongly-typed configuration consumed via ConfigService. */
export function loadConfiguration(): Config {
  const env = validateEnv(process.env);
  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    http: {
      port: env.API_PORT,
      host: env.API_HOST,
      corsOrigins: env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
    },
    database: { url: env.DATABASE_URL },
    redis: { url: env.REDIS_URL },
    storage: {
      driver: env.STORAGE_DRIVER,
      localDir: env.STORAGE_LOCAL_DIR,
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKey: env.S3_ACCESS_KEY,
      secretKey: env.S3_SECRET_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
    },
    ai: {
      provider: env.AI_PROVIDER,
      baseUrl: env.AI_BASE_URL,
      apiKey: env.AI_API_KEY,
      defaultChatModel: env.AI_DEFAULT_CHAT_MODEL,
      defaultEmbeddingModel: env.AI_DEFAULT_EMBEDDING_MODEL,
      embeddingDimensions: env.AI_EMBEDDING_DIMENSIONS,
      requestTimeoutMs: env.AI_REQUEST_TIMEOUT_MS,
    },
    observability: {
      logLevel: env.LOG_LEVEL,
      metricsEnabled: env.METRICS_ENABLED,
    },
  };
}

export interface Config {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  http: { port: number; host: string; corsOrigins: string[] };
  database: { url: string };
  redis: { url: string };
  storage: {
    driver: 's3' | 'filesystem';
    localDir: string;
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    forcePathStyle: boolean;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
  };
  ai: {
    provider: 'ollama' | 'openai-compatible' | 'mock';
    baseUrl: string;
    apiKey: string;
    defaultChatModel: string;
    defaultEmbeddingModel: string;
    embeddingDimensions: number;
    requestTimeoutMs: number;
  };
  observability: { logLevel: string; metricsEnabled: boolean };
}

/** Typed accessor key for ConfigService.get<Config>('app'). */
export const CONFIG_NAMESPACE = 'app';
