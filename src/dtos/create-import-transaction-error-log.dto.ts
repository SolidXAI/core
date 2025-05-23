import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, IsInt, IsJSON, IsOptional } from 'class-validator';
export class CreateImportTransactionErrorLogDto {
@IsNotEmpty()
@IsString()
@ApiProperty()
importTransactionErrorLogId: string;

@IsNotEmpty()
@IsInt()
@ApiProperty()
rowNumber: number;

@IsOptional()
@IsJSON()
@ApiProperty()
rowData: any;

@IsOptional()
@IsInt()
@ApiProperty()
importTransactionId: number;

@IsString()
@IsOptional()
@ApiProperty()
importTransactionUserKey: string;

@IsNotEmpty()
@IsString()
@ApiProperty()
errorMessage: string;

@IsOptional()
@IsString()
@ApiProperty()
errorTrace: string;
}