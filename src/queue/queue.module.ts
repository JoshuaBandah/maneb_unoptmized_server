// queue/queue.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ResultsQueueProducer } from './queue.producer';
import { ResultsQueueProcessor } from './queue.processor';
import { GradesModule } from '../grades/grades.module';

@Module({
    imports: [
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
                removeOnComplete: {
                    age: 3600, // keep for 1 hour
                },

                removeOnFail: {
                    age: 3600, // keep failed jobs for 24 hours
                },
            },
        }),
        forwardRef(() => GradesModule),
    ],
    providers: [ResultsQueueProducer, ResultsQueueProcessor],
    exports: [ResultsQueueProducer],
})
export class QueueModule { }