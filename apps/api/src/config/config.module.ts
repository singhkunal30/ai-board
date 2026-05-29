import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { Config, loadConfiguration, validateEnv } from './configuration';

/** DI token for the strongly-typed application config. */
export const APP_CONFIG = Symbol('APP_CONFIG');

/**
 * Loads `.env` (via @nestjs/config), validates the whole environment with zod,
 * and exposes a single immutable, typed `Config` object app-wide.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Validate eagerly; throws with a readable message on misconfiguration.
      validate: validateEnv,
      envFilePath: ['.env', '../../.env'],
    }),
  ],
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): Config => loadConfiguration(),
    },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
