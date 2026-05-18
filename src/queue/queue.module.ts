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
                max: 10000,        // Max 300 jobs per
                duration: 1000,  // 1 second
            },
            defaultJobOptions: {
                attempts: 3,           // Retry failed jobs 3 times
                backoff: {
                    type: 'exponential',
                    delay: 3000,
                },
                timeout: 60000,       // 60 second job timeout
                removeOnComplete: {
                    age: 300, // keep for 5 min
                },

                removeOnFail: {
                    age: 300, 
                },
            },
        }),
        forwardRef(() => GradesModule),
    ],
    providers: [ResultsQueueProducer, ResultsQueueProcessor],
    exports: [ResultsQueueProducer],
})
export class QueueModule { }