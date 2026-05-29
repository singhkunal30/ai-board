import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness — the process is up. */
  @Public()
  @Get()
  live(): { status: string; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }

  /** Readiness — dependencies the app needs to serve traffic are reachable. */
  @Public()
  @Get('ready')
  async ready(): Promise<{ status: string; checks: Record<string, boolean> }> {
    const checks: Record<string, boolean> = {};
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }
    const status = Object.values(checks).every(Boolean) ? 'ok' : 'degraded';
    return { status, checks };
  }
}
