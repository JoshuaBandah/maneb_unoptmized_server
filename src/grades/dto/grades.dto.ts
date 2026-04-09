// student-marks.dto.ts
import {
    IsString,
    IsNumber,
    IsOptional,
    IsDateString,
    Min,
    Max,
    IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class gradesDto {
    // Personal Information
    @IsString()
    @IsNotEmpty()
    first_name!: string;

    @IsString()
    @IsOptional()
    middle_name?: string;

    @IsString()
    @IsNotEmpty()
    last_name!: string;

    @IsDateString()
    @IsNotEmpty()
    date_of_birth!: string;

    // Subjects
    @IsString()
    @IsNotEmpty()
    Subject!: number;

    @IsString()
    @IsNotEmpty()
    marks!: number;

    @IsString()
    @IsNotEmpty()
    exam_center!: string;

    @IsString()
    @IsNotEmpty()
    student_number!:string
}