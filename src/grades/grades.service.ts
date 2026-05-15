import { Injectable, BadRequestException, InternalServerErrorException, Inject, ConflictException } from '@nestjs/common';
import { sql } from '../db/db';
import { StudentMarksDto } from './dto/studentsMarks.dto';
import { gradeReultsRequest } from './dto/gradeReultsRequest.dto';
import type { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class GradesService {
  constructor(private readonly redis: RedisService) { }

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

      const val = await this.redis.get('debug_key');
      const cached = await this.redis.get<StudentMarksDto>(cacheKey);

      if (cached) {
        return cached;
      }
      const results = await sql`
      SELECT * FROM grades
      WHERE date_of_birth = ${date_of_birth} 
        AND student_number = ${student_number}
      LIMIT 1;
    `;

      if (!results || results.length === 0) {
        throw new BadRequestException(
          'No results found for the provided student number and date of birth',
        );
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

      await this.redis.set(cacheKey, response, 60);

      return response;
    } catch (error) {

      if (error instanceof BadRequestException) throw error;

      throw new InternalServerErrorException(
        'Failed to retrieve student results',
      );
    }
  }


async preLoadResultsFromDbToCache() {
  try {
    const BATCH_SIZE = 1000;
    let lastId = 0;
    let hasMore = true;

    while (hasMore) {
      const grades = await sql`
        SELECT *
        FROM grades
        WHERE id > ${lastId}
        ORDER BY id
        LIMIT ${BATCH_SIZE}
      `;

      if (grades.length === 0) {
        hasMore = false;
        break;
      }

      await Promise.all(
        grades.map((grade) => {
          const normalizedDob =
            grade.date_of_birth instanceof Date
              ? grade.date_of_birth.toISOString().split('T')[0]
              : String(grade.date_of_birth).split('T')[0];

          const cacheKey = `student:${grade.student_number}:${normalizedDob}`;


          const preparedGrade: StudentMarksDto = {
            first_name: grade.first_name,
            middle_name: grade.middle_name,
            last_name: grade.last_name,
            date_of_birth: grade.date_of_birth,
            student_number: grade.student_number,
            exam_center: grade.exam_center,
            accounting: grade.accounting,
            agriculture: grade.agriculture,
            bible_knowledge: grade.bible_knowledge,
            biology: grade.biology,
            business_studies: grade.business_studies,
            chemistry: grade.chemistry,
            chichewa: grade.chichewa,
            computer_studies: grade.computer_studies,
            english: grade.english,
            geography: grade.geography,
            history: grade.history,
            home_economics: grade.home_economics,
            mathematics: grade.mathematics,
            physics: grade.physics,
            social_studies: grade.social_studies,
            technical_drawing: grade.technical_drawing,
          };

          return this.redis.set(cacheKey, preparedGrade, 86400);
        })
      );

      // move cursor forward
      lastId = grades[grades.length - 1].id;
    }

  } catch (error) {
    console.error(error);
  }
}

  // clear Redis cache after a new upload
  async clearCache(student_number: string, date_of_birth: string) {
    const key = `student:${student_number}:${date_of_birth}`;
    await this.redis.del(key);
  }

}



type ErrorEntry = {
  row: number;
  missing?: string[];
  invalidMarks?: string[];
  error?: string;
};

