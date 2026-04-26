// queue/queue.interface.ts
export interface QueueResponse {
  jobId: string;
  queued: boolean;
  position: number;
  estimatedWaitTime?: number;
}

export interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
}