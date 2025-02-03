import { IsInt,IsOptional, IsDate, IsNotEmpty, IsString } from 'class-validator';
export class UpdateExportTransactionDto {
    @IsOptional()
    @IsInt()
    id: number;

@IsNotEmpty()
@IsOptional()
@IsDate()
datetime: Date;

@IsNotEmpty()
@IsOptional()
@IsString()
status: string;
}