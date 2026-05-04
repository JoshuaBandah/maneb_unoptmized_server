import { forwardRef, Module } from '@nestjs/common';
import { GradesService } from './grades.service';
import { GradesController } from './grades.controller';
import { CacheModule } from '@nestjs/cache-manager';
import { RedisService } from '../redis/redis.service';
import { QueueModule } from '../queue/queue.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    RedisModule,
    forwardRef(() => QueueModule),
    // QueueModule
  ],
  controllers: [GradesController],
  providers: [GradesService, RedisService],
  exports: [GradesService],
})
export class GradesModule { }
