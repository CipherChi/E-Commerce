import { IsDateString, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
export class ExpenseDto {
 @IsString() categoryId!: string;
 @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
 @IsOptional() @IsString() description?: string;
 @IsDateString() expenseDate!: string;
}
export class CategoryDto { @IsString() @MinLength(1) name!: string; }
