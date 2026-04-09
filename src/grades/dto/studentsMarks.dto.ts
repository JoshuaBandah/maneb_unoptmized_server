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

export class StudentMarksDto {
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
    @IsNumber()
    @Min(0)
    @Max(100)
    accounting!: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    agriculture!: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    bible_knowledge!: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    biology!: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    business_studies!: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    chemistry!: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    chichewa!: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    computer_studies!: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    english!: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    geography!: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    history!: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    home_economics!: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    mathematics!: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    physics!: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    social_studies!: number;

    @IsNumber()
    @Min(0)
    @Max(100)
    technical_drawing!: number;

    @IsString()
    @IsNotEmpty()
    exam_center!: string;

    @IsString()
    @IsNotEmpty()
    student_number!:string
}