import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

/** Records request count and latency for every HTTP request. */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<FastifyRequest & { routeOptions?: { url?: string } }>();
    const res = http.getResponse<FastifyReply>();
    const start = process.hrtime.bigint();
    // Prefer the route template (low cardinality) over the concrete URL.
    const route = req.routeOptions?.url ?? req.url.split('?')[0] ?? 'unknown';
    const method = req.method;

    const record = () => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      const status = String(res.statusCode);
      const labels = { method, route, status };
      this.metrics.httpRequests.inc(labels);
      this.metrics.httpDuration.observe(labels, seconds);
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
