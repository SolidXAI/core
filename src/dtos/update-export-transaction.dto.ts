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

@IsOptional()
@IsString()
error: string;

@IsOptional()
@IsInt()
exportTemplateId: number;

@IsString()
@IsOptional()
exportTemplateUserKey: string;
}