import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, InternalServerErrorException, Req, BadRequestException } from '@nestjs/common';
import { GradesService } from './grades.service';
import { CreateGradeDto } from './dto/create-grade.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import * as XLSX from 'xlsx';
import { StudentMarksDto } from './dto/studentsMarks.dto';
import { gradeReultsRequest } from './dto/gradeReultsRequest.dto';
@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) { }

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

  @Post('view-results')
  async viewResults(@Body() request: gradeReultsRequest) {
    try {
      const result = await this.gradesService.viewResults(request);

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
}
