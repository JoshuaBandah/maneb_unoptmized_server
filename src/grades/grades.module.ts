import { Module } from '@nestjs/common';
import { GradesService } from './grades.service';
import { GradesController } from './grades.controller';
import { CacheModule } from '@nestjs/cache-manager';
import { RedisService } from '../redis/redis.service';

@Module({
  imports:[
    
  ],
  controllers: [GradesController],
  providers: [GradesService,RedisService],
})
export class GradesModule {}
