import { IsDate } from 'class-validator';
import { IsNotEmpty, IsString, IsOptional, IsInt } from 'class-validator';
export class CreateExportTransactionDto {
constructor(data: Partial<CreateExportTransactionDto>) {
    Object.assign(this, data);
}    
@IsNotEmpty()
@IsDate()
datetime: Date;

@IsNotEmpty()
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