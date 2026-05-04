import {  Reflector } from '@nestjs/core'; // ← Import Reflector
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthenticationModule } from './authentication/authentication.module';
import { UserModule } from './user/user.module';
import { JwtService } from '@nestjs/jwt';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthGuard } from './authentication/auth.guard';
import { GradesModule } from './grades/grades.module';
import { makeCounterProvider, makeHistogramProvider, PrometheusModule } from "@willsoto/nestjs-prometheus";
import { MetricsInterceptor } from './metrics/metricsInterceptor';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueModule } from './queue/queue.module';
@Module({
  imports: [
    AuthenticationModule, 
    UserModule, 
    GradesModule,
    PrometheusModule.register({
      path: "/metrics",
      defaultMetrics: {
        enabled: true,
        config: {}
      },
    }),
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({
      name: 'results-queue',
      limiter: {
        max: 100,        // Max 100 jobs per
        duration: 1000,  // 1 second
      },
      defaultJobOptions: {
        attempts: 3,           // Retry failed jobs 3 times
        backoff: 5000,        // Wait 5 seconds between retries
        timeout: 30000,       // 30 second job timeout
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    QueueModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtService,
    Reflector,  // ← ADD THIS LINE
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    // metric providers
    makeCounterProvider({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
    }),
    makeCounterProvider({
      name: 'http_requests_failed_total',
      help: 'Total number of failed HTTP requests',
      labelNames: ['method', 'route', 'status'],
    }),
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.3, 0.5, 1, 2, 5],
    }),
    MetricsInterceptor,
    // {
    //   provide: APP_INTERCEPTOR,
    //   useClass: MetricsInterceptor,
    // },

  ],
})
export class AppModule { }