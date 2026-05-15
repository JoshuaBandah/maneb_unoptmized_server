import { Reflector } from '@nestjs/core'; // ← Import Reflector
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
  
    QueueModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtService,
    Reflector,
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