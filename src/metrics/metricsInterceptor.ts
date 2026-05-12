import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Counter, Histogram } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Reflector } from '@nestjs/core';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly excludedPaths = [
    '/metrics',
    '/health',
    '/authentication/login',
    '/user/register',
    '/grades/queue/status/:jobId'
  ];

  constructor(
    @InjectMetric('http_requests_total')
    private readonly requestCounter: Counter<string>,

    @InjectMetric('http_requests_failed_total')
    private readonly failedCounter: Counter<string>,

    @InjectMetric('http_request_duration_seconds')
    private readonly durationHistogram: Histogram<string>,
    private readonly reflector: Reflector,
  ) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const method = request.method;

    // Get the route path from the handler or controller
    let path = request.route?.path;

    // If route path is not available, try to build it from the handler
    if (!path) {
      const handler = context.getHandler();
      const controller = context.getClass();
      const controllerPath = this.reflector.get('path', controller) || '';
      const handlerPath = this.reflector.get('path', handler) || '';
      path = controllerPath + handlerPath;
    }

    // Fallback to URL only as last resort
    if (!path) {
      path = request.url.split('?')[0]; // Remove query params
    }

    // Normalize IDs in path to avoid label explosion
    path = this.normalizePath(path);

    // Check excluded paths after normalization
    if (this.excludedPaths.some((p) => path.includes(p))) {
      return next.handle();
    }

    const endTimer = this.durationHistogram.startTimer({
      method,
      route: path,
    });

    return next.handle().pipe(
      tap(() => {
        const status = response.statusCode;

        this.requestCounter.inc({
          method,
          route: path,
          status,
        });

        endTimer({ status });
      }),

      catchError((err) => {
        const status = err.status || 500;

        this.requestCounter.inc({
          method,
          route: path,
          status,
        });

        this.failedCounter.inc({
          method,
          route: path,
          status,
        });
        endTimer({ status });

        return throwError(() => err);
      }),
    );
  }

  private normalizePath(path: string): string {
    // Replace numeric IDs with :id
    return path.replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9]{24}/g, '/:id') // For MongoDB ObjectIds
      .replace(/\?.*$/, ''); // Remove query strings
  }
}