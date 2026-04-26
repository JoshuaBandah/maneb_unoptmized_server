// queue/queue.producer.ts
import { Injectable } from '@nestjs/common';
import bull from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { QueueResponse, QueueStatus } from './queue.interface';

@Injectable()
export class ResultsQueueProducer {
  constructor(
    @InjectQueue('results-queue') private resultsQueue: bull.Queue,
  ) {}

  async addToQueue(
    student_number: string, 
    date_of_birth: string
  ): Promise<QueueResponse> {
    const waitingCount = await this.resultsQueue.getWaitingCount();
    const activeCount = await this.resultsQueue.getActiveCount();
    

    if (waitingCount + activeCount > 10000) {
      throw new Error('Queue full - try again later');
    }
    
    const job = await this.resultsQueue.add('process-result', {
      student_number,
      date_of_birth,
      timestamp: new Date().toISOString(),
    });
    
    return {
      jobId: job.id.toString(),
      queued: true,
      position: waitingCount + activeCount + 1,
      estimatedWaitTime: (waitingCount + activeCount + 1) * 0.5, // 0.5 seconds per job
    };
  }
  
  async getJob(jobId: string): Promise<any> {
    return await this.resultsQueue.getJob(jobId);
  }
  
  async getQueueStatus(): Promise<QueueStatus> {
    const [waiting, active, completed, failed] = await Promise.all([
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