import { IsDateString, IsOptional, IsString, Matches, MinLength } from 'class-validator';
export class ExpenseDto {
 @IsString() categoryId!: string;
 @IsString() @Matches(/^\d+(\.\d{1,2})?$/) amount!: string;
 @IsOptional() @IsString() description?: string;
 @IsDateString() expenseDate!: string;
}
export class CategoryDto { @IsString() @MinLength(1) name!: string; }
