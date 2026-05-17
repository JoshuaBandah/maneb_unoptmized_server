import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, InternalServerErrorException, Req, BadRequestException, Query, Res } from '@nestjs/common';
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import * as XLSX from 'xlsx';
import { StudentMarksDto } from './dto/studentsMarks.dto';
import { gradeReultsRequest } from './dto/gradeReultsRequest.dto';
import { Public } from '../common/decorators/public.decorator';
import { query } from 'winston';
import { ResultsQueueProducer } from '../queue/queue.producer';
import express from 'express';
import 'multer';

@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService, private readonly queueProducer: ResultsQueueProducer) { }

  @Post('upload-grades')
  @UseInterceptors(FileInterceptor('grades'))
  async uploadExcel(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    try {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }
      const workbook = XLSX.read(file.buffer, {
        type: 'buffer',
        cellDates: true,
        dateNF: 'yyyy-mm-dd'
      });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const data: StudentMarksDto[] = XLSX.utils.sheet_to_json(worksheet);

      if (!data || data.length === 0) {
        throw new BadRequestException('No data found in Excel file');
      }

      const result = await this.gradesService.createGradesFromFile(data);

      return {
        success: true,
        message: 'Grades uploaded successfully',
        data: result
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process Excel file');
    }
  }

  @Public()
  @Get('view-cached-results')
  async viewCachedResults(@Query() query: gradeReultsRequest) {
    try {
      const result = await this.gradesService.viewCachedResults(query);

      return {
        success: true,
        message: 'Results retrieved successfully',
        data: result
      };
    } catch (error) {
      console.error('View results error:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException({
        success: false,
        message: 'Failed to retrieve results',
      });
    }
  }

  // New endpoint with queue support (non-blocking)
  // grades/grades.controller.ts
  @Public()
  @Get('view-cached-results-que')
  async viewcachedResultsWithQueue(
    @Query() query: gradeReultsRequest,
    @Res() res: express.Response,
  ) {
    try {
      const { jobId, queued, position } = await this.queueProducer.addToQueue(
        query.student_number,
        query.date_of_birth,
      );

      console.log(process.pid);
      res.status(202).json({
        success: true,
        message: 'Request queued for processing',
        data: {
          jobId,
          queued,
          position,
          statusUrl: `/grades/queue/status/${jobId}`,
          estimatedWaitTime: position * 0.5,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage === 'Queue full - try again later') {
        res.status(503).json({
          success: false,
          message: 'Server is busy. Please try again later.',
          queueFull: true,
        });
      } else {
        console.error('Queue error:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to queue request',
        });
      }
    }
  }

  // Endpoint to check job status
  @Public()
  @Get('queue/status/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {

    // console.log(`Worker ${process.pid} handled request`);
    const job = await this.queueProducer.getJob(jobId);

    if (!job) {
      return {
        success: false,
        message: 'Job not found',
        jobId,
        status: 'not_found',
      };
    }

    const state = await job.getState();
    const progress = job.progress();
    const result = job.returnvalue;

    return {
      success: true,
      jobId,
      status: state,
      progress,
      result: state === 'completed' ? result : undefined,
      message: state === 'completed'
        ? 'Results ready'
        : state === 'failed'
          ? 'Processing failed'
          : 'Processing in progress',
    };
  }

  // Optional: Keep original endpoint for direct processing (blocking)
  @Public()
  @Get('view-uncached-results-direct')
  async viewUncachedResultsDirect(@Query() query: gradeReultsRequest) {
    try {
      // Direct processing (original behavior)
      const result = await this.gradesService.viewUncachedResults(query);

      return {
        success: true,
        message: 'Results retrieved successfully',
        data: result
      };
    } catch (error) {
      console.error('View results error:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException({
        success: false,
        message: 'Failed to retrieve results',
      });
    }
  }

  @Public()
  @Post('pre-cache-results')
  async preCacheResults() {
    try {
      await this.gradesService.preLoadResultsFromDbToCache()
    } catch (error) {
      console.error(error)
    }
  }
}
