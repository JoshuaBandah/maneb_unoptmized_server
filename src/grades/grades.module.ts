import { Module } from '@nestjs/common';
import { GradesService } from './grades.service';
import { GradesController } from './grades.controller';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports:[
    
  ],
  controllers: [GradesController],
  providers: [GradesService],
})
export class GradesModule {}
