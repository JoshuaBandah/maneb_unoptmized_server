// gradeReultsRequest.dto.ts
import { IsNotEmpty, IsString } from "class-validator";
import { Transform } from "class-transformer";

export class gradeReultsRequest {
    @IsString()
    @IsNotEmpty()
    student_number!: string

    @IsString()
    @IsNotEmpty()
    @Transform(({ value }) => {
        // Convert MM/DD/YY to YYYY-MM-DD
        if (value && typeof value === 'string' && value.includes('/')) {
            const parts = value.split('/');
            if (parts.length === 3) {
                let month = parts[0].padStart(2, '0');  // MM
                let day = parts[1].padStart(2, '0');    // DD
                let year = parts[2];                     // YY
                
                // Convert 2-digit year to 4-digit year
                if (year.length === 2) {
                    const yearNum = parseInt(year);
                    // Adjust threshold based on your needs
                    // For birth dates: years 00-23 = 2000-2023, years 24-99 = 1924-1999
                    if (yearNum >= 0 && yearNum <= 23) {
                        year = `20${year}`;
                    } else {
                        year = `19${year}`;
                    }
                }
                
                return `${year}-${month}-${day}`;
            }
        }
        return value;
    })
    date_of_birth!: string
}