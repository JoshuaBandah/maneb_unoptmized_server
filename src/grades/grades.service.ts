import { Injectable, BadRequestException, InternalServerErrorException, Inject, ConflictException } from '@nestjs/common';
import { sql } from '../db/db';
import { StudentMarksDto } from './dto/studentsMarks.dto';
import { gradeReultsRequest } from './dto/gradeReultsRequest.dto';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class GradesService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) { }

  async createGradesFromFile(data: StudentMarksDto[]) {
    if (!data || data.length === 0) {
      throw new BadRequestException('No data provided');
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: ErrorEntry[] = []; // Explicitly type the array

    try {
      return await sql.begin(async (sql) => {
        for (const [index, row] of data.entries()) {
          try {
            // console.log(`Processing row ${index + 1}:`, row);

            const {
              accounting,
              agriculture,
              bible_knowledge,
              biology,
              business_studies,
              chemistry,
              chichewa,
              computer_studies,
              english,
              first_name,
              geography,
              history,
              home_economics,
              last_name,
              mathematics,
              middle_name,
              physics,
              social_studies,
              technical_drawing,
              date_of_birth,
              exam_center,
              student_number
            } = row;

            const requiredFields = {
              first_name, last_name, date_of_birth,
              accounting, agriculture, bible_knowledge, biology,
              business_studies, chemistry, chichewa, computer_studies,
              english, geography, history, home_economics, mathematics,
              physics, social_studies, technical_drawing,
              exam_center,
              student_number
            };

            const missingFields = Object.entries(requiredFields)
              .filter(([_, value]) => value === undefined || value === null || value === '')
              .map(([key]) => key);

            if (missingFields.length > 0) {
              console.warn(`Skipping row ${index + 1} due to missing fields:`, missingFields);
              errorCount++;
              errors.push({ row: index + 1, missing: missingFields });
              continue;
            }

            const numericFields = {
              accounting, agriculture, bible_knowledge, biology,
              business_studies, chemistry, chichewa, computer_studies,
              english, geography, history, home_economics, mathematics,
              physics, social_studies, technical_drawing
            };

            const invalidValues = Object.entries(numericFields)
              .filter(([_, value]) => typeof value === 'number' && (value < 0 || value > 100))
              .map(([key]) => key);

            if (invalidValues.length > 0) {
              console.warn(`Skipping row ${index + 1} due to invalid marks (0-100 range):`, invalidValues);
              errorCount++;
              errors.push({ row: index + 1, invalidMarks: invalidValues });
              continue;
            }

            // Insert into student_marks table
            await sql`
              INSERT INTO grades (
                accounting, agriculture, bible_knowledge, biology, 
                business_studies, chemistry, chichewa, computer_studies, 
                english, first_name, geography, history, home_economics, 
                last_name, mathematics, middle_name, physics, 
                social_studies, technical_drawing, date_of_birth,exam_center,student_number
              ) VALUES (
                ${accounting}, ${agriculture}, ${bible_knowledge}, ${biology}, 
                ${business_studies}, ${chemistry}, ${chichewa}, ${computer_studies}, 
                ${english}, ${first_name}, ${geography}, ${history}, ${home_economics}, 
                ${last_name}, ${mathematics}, ${middle_name || null}, ${physics}, 
                ${social_studies}, ${technical_drawing}, ${date_of_birth},${exam_center},
                 ${student_number}
              );
            `;

            console.log(`Record created for student: ${first_name} ${last_name} (Row ${index + 1})`);
            successCount++;

          }
          catch (rowError) {
            console.error(`Error processing row ${index + 1}:`, rowError);
            errorCount++;
            errors.push({
              row: index + 1,
              error: (rowError as Error).message || 'Unknown error processing row'
            });
            continue;
          }
        }

        return {
          message: 'Grade upload completed',
          summary: {
            total: data.length,
            successful: successCount,
            failed: errorCount
          },
          errors: errors.length > 0 ? errors : undefined
        };
      });
    } catch (error) {
      console.error('Transaction failed:', error);

      if (error instanceof ConflictException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create grade records');
    }
  }


  // async generateGradesFromFile(data: StudentMarksDto[]) {
  //   if (!data || data.length === 0) {
  //     throw new BadRequestException('No data provided');
  //   }

  //   let successCount = 0;
  //   let errorCount = 0;
  //   const errors: ErrorEntry[] = [];

  //   try {
  //     return await sql.begin(async (sql) => {
  //       for (const [index, row] of data.entries()) {


  //         try {
  //           console.log(`Processing row ${index + 1}:`, row);
  //           const {
  //             first_name,
  //             last_name,
  //             middle_name,
  //             date_of_birth,
  //             exam_center,
  //             Subject,
  //             marks,
  //             student_number
  //           } = row;

  //           const requiredFields = {
  //             first_name, last_name, date_of_birth,
  //             Subject,
  //             marks,
  //             exam_center,
  //             student_number
  //           };

  //           const missingFields = Object.entries(requiredFields)
  //             .filter(([_, value]) => value === undefined || value === null || value === '')
  //             .map(([key]) => key);

  //           if (missingFields.length > 0) {
  //             console.warn(`Skipping row ${index + 1} due to missing fields:`, missingFields);
  //             errorCount++;
  //             errors.push({ row: index + 1, missing: missingFields });
  //             continue;
  //           }

  //           const numericFields = {
  //        marks
  //           };

  //           const invalidValues = Object.entries(numericFields)
  //             .filter(([_, value]) => typeof value === 'number' && (value < 0 || value > 100))
  //             .map(([key]) => key);

  //           if (invalidValues.length > 0) {
  //             console.warn(`Skipping row ${index + 1} due to invalid marks (0-100 range):`, invalidValues);
  //             errorCount++;
  //             errors.push({ row: index + 1, invalidMarks: invalidValues });
  //             continue;
  //           }

  //           // Insert into student_marks table
  //           await sql`
  //             INSERT INTO grades (
  //               first_name,
  //               last_name, middle_name,date_of_birth,exam_center,student_number,Subject,
  //               marks,
  //             ) VALUES (
  //               ${first_name},${last_name}, ${middle_name || null}, ${date_of_birth},${exam_center},
  //                ${student_number}, ${Subject}, ${marks}
  //             );
  //           `;

  //           console.log(`Record created for student: ${first_name} ${last_name} (Row ${index + 1})`);
  //           successCount++;

  //         }
  //         catch (rowError) {
  //           console.error(`Error processing row ${index + 1}:`, rowError);
  //           errorCount++;
  //           errors.push({
  //             row: index + 1,
  //             error: (rowError as Error).message || 'Unknown error processing row'
  //           });
  //           continue;
  //         }
  //       }

  //       return {
  //         message: 'Grade upload completed',
  //         summary: {
  //           total: data.length,
  //           successful: successCount,
  //           failed: errorCount
  //         },
  //         errors: errors.length > 0 ? errors : undefined
  //       };
  //     });
  //   } catch (error) {
  //     console.error('Transaction failed:', error);

  //     if (error instanceof ConflictException) {
  //       throw error;
  //     }

  //     throw new InternalServerErrorException('Failed to create grade records');
  //   }
  // }

  async viewUncachedResults(data: gradeReultsRequest): Promise<StudentMarksDto> {
    try {
      const { date_of_birth, student_number } = data;

      if (!date_of_birth || !student_number) {
        throw new BadRequestException('Date of birth and student number are required');
      }

      const results = await sql`
      SELECT * FROM grades 
      WHERE date_of_birth = ${date_of_birth} 
        AND student_number = ${student_number}
      LIMIT 1;
    `;

      if (!results || results.length === 0) {
        throw new BadRequestException('No results found for the provided student number and date of birth');
      }

      const result = results[0];


      return {
        first_name: result.first_name,
        middle_name: result.middle_name,
        last_name: result.last_name,
        date_of_birth: result.date_of_birth,
        student_number: result.student_number,
        exam_center: result.exam_center,
        accounting: result.accounting,
        agriculture: result.agriculture,
        bible_knowledge: result.bible_knowledge,
        biology: result.biology,
        business_studies: result.business_studies,
        chemistry: result.chemistry,
        chichewa: result.chichewa,
        computer_studies: result.computer_studies,
        english: result.english,
        geography: result.geography,
        history: result.history,
        home_economics: result.home_economics,
        mathematics: result.mathematics,
        physics: result.physics,
        social_studies: result.social_studies,
        technical_drawing: result.technical_drawing
      };
    } catch (error) {
      console.error('Error viewing results:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if ((error as any).code === '42P01') {
        throw new InternalServerErrorException('Grades table not found');
      }

      throw new InternalServerErrorException('Failed to retrieve student results');
    }
  }



  async viewCachedResults(data: gradeReultsRequest): Promise<StudentMarksDto> {
    const { date_of_birth, student_number } = data;

    const cacheKey = `student:${student_number}:${date_of_birth}`;

    try {
      //Use cacheManager
      const cached = await this.cacheManager.get<StudentMarksDto>(cacheKey);
      if (cached) {
        console.log('Returning cached result for', cacheKey);
        return cached;
      }


      const results = await sql`
        SELECT * FROM grades
        WHERE date_of_birth = ${date_of_birth} 
          AND student_number = ${student_number}
        LIMIT 1;
      `;

      if (!results || results.length === 0) {
        throw new BadRequestException('No results found for the provided student number and date of birth');
      }


      const result = results[0];
      const response: StudentMarksDto = {
        first_name: result.first_name,
        middle_name: result.middle_name,
        last_name: result.last_name,
        date_of_birth: result.date_of_birth,
        student_number: result.student_number,
        exam_center: result.exam_center,
        accounting: result.accounting,
        agriculture: result.agriculture,
        bible_knowledge: result.bible_knowledge,
        biology: result.biology,
        business_studies: result.business_studies,
        chemistry: result.chemistry,
        chichewa: result.chichewa,
        computer_studies: result.computer_studies,
        english: result.english,
        geography: result.geography,
        history: result.history,
        home_economics: result.home_economics,
        mathematics: result.mathematics,
        physics: result.physics,
        social_studies: result.social_studies,
        technical_drawing: result.technical_drawing,
      };

      // Cache the result using cacheManager
      await this.cacheManager.set(cacheKey, response);

      return response;
    } catch (error) {

      if (error instanceof BadRequestException) throw error;

      throw new InternalServerErrorException('Failed to retrieve student results');
    }
  }

  // Optional: clear Redis cache after a new upload
  async clearCache(student_number: string, date_of_birth: string) {
    const key = `student:${student_number}:${date_of_birth}`;
    await this.cacheManager.del(key);
  }
}


// import { ConflictException, Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
// import { sql } from '../db/db';
// import { StudentMarksDto } from './dto/studentsMarks.dto';
// import { gradeReultsRequest } from './dto/gradeReultsRequest.dto';
// import { gradesDto } from './dto/grades.dto';

// Define the error type
type ErrorEntry = {
  row: number;
  missing?: string[];
  invalidMarks?: string[];
  error?: string;
};

