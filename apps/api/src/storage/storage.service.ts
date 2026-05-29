import { promises as fs } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client as MinioClient } from 'minio';
import { APP_CONFIG } from '../config/config.module';
import { Config } from '../config/configuration';

interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/** Local filesystem driver — zero external dependencies, ideal for dev/test. */
class FilesystemDriver implements StorageDriver {
  constructor(private readonly baseDir: string) {}

  private path(key: string): string {
    // Prevent path traversal; keep keys under baseDir.
    const safe = key.replace(/\.\./g, '').replace(/^\/+/, '');
    return join(resolve(this.baseDir), safe);
  }

  async put(key: string, body: Buffer): Promise<void> {
    const p = this.path(key);
    await fs.mkdir(dirname(p), { recursive: true });
    await fs.writeFile(p, body);
  }

  get(key: string): Promise<Buffer> {
    return fs.readFile(this.path(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.path(key), { force: true });
  }
}

/** S3-compatible driver (MinIO, AWS S3, …). */
class S3Driver implements StorageDriver {
  constructor(
    private readonly client: MinioClient,
    private readonly bucket: string,
  ) {}

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.putObject(this.bucket, key, body, body.length, {
      'Content-Type': contentType,
    });
  }

  async get(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }
}

/**
 * Object storage facade. Selects a driver from config; ensures the S3 bucket
 * exists on boot. Keys are namespaced by workspace for tenant isolation.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private driver!: StorageDriver;

  constructor(@Inject(APP_CONFIG) private readonly config: Config) {}

  async onModuleInit(): Promise<void> {
    const s = this.config.storage;
    if (s.driver === 'filesystem') {
      this.driver = new FilesystemDriver(s.localDir);
      this.logger.log(`Storage: filesystem at ${resolve(s.localDir)}`);
      return;
    }

    const url = new URL(s.endpoint);
    const client = new MinioClient({
      endPoint: url.hostname,
      port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
      useSSL: url.protocol === 'https:',
      accessKey: s.accessKey,
      secretKey: s.secretKey,
      region: s.region,
      pathStyle: s.forcePathStyle,
    });
    try {
      const exists = await client.bucketExists(s.bucket).catch(() => false);
      if (!exists) await client.makeBucket(s.bucket, s.region);
    } catch (err) {
      this.logger.warn(`Could not ensure bucket "${s.bucket}": ${(err as Error).message}`);
    }
    this.driver = new S3Driver(client, s.bucket);
    this.logger.log(`Storage: S3 (${s.endpoint}/${s.bucket})`);
  }

  key(workspaceId: string, filename: string): string {
    const stamp = Date.now();
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `workspaces/${workspaceId}/${stamp}-${safe}`;
  }

  put(key: string, body: Buffer, contentType: string): Promise<void> {
    return this.driver.put(key, body, contentType);
  }

  get(key: string): Promise<Buffer> {
    return this.driver.get(key);
  }

  delete(key: string): Promise<void> {
    return this.driver.delete(key);
  }
}
