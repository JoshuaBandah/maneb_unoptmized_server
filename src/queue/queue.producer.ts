// queue/queue.producer.ts

import { Injectable } from '@nestjs/common';
import bull from 'bull';
import { InjectQueue } from '@nestjs/bull';
import {
  QueueResponse,
  QueueStatus,
} from './queue.interface';

@Injectable()
export class ResultsQueueProducer {
  constructor(
    @InjectQueue('results-queue')
    private resultsQueue: bull.Queue,
  ) {}

  async addToQueue(
    student_number: string,
    date_of_birth: string,
  ): Promise<QueueResponse> {
    const job = await this.resultsQueue.add(
      'process-result',
      {
        student_number,
        date_of_birth,
        timestamp: Date.now(),
      },
    );

    return {
      jobId: job.id.toString(),
      queued: true,
      position: -1,
      estimatedWaitTime: -1,
    };
  }

  async getJob(jobId: string): Promise<any> {
    return await this.resultsQueue.getJob(jobId);
  }

  async getQueueStatus(): Promise<QueueStatus> {
    const [
      waiting,
      active,
      completed,
      failed,
    ] = await Promise.all([
      this.resultsQueue.getWaitingCount(),
      this.resultsQueue.getActiveCount(),
      this.resultsQueue.getCompletedCount(),
      this.resultsQueue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active,
    };
  }
}