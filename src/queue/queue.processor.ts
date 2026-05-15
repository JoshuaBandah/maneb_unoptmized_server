// queue/queue.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { GradesService } from '../grades/grades.service';
import type { Job } from 'bull';
import { gradeReultsRequest } from '../grades/dto/gradeReultsRequest.dto';

@Processor('results-queue')
export class ResultsQueueProcessor {
  constructor(private gradesService: GradesService) {}
  
  @Process('process-result')
  async handleResult(job: Job) {
    const { student_number, date_of_birth } = job.data as gradeReultsRequest;
    
    

    // Validate required fields
    if (!student_number || !date_of_birth) {
      console.error(`Missing required fields for job ${job.id}:`, { student_number, date_of_birth });
      throw new Error('Missing required fields: student_number and date_of_birth are required');
    }
    
    try {
      // Process the actual request
      const result = await this.gradesService.viewCachedResults({
        student_number, 
        date_of_birth
      });


      await job.progress(100);
      
      
      return { 
        success: true, 
        data: result,
        processedAt: new Date().toISOString()
      };
    } catch (error) {
      // Log error and let Bull retry
      throw error;
    }
  }
}