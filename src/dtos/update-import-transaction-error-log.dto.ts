import { IsInt,IsOptional, IsString, IsNotEmpty, IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateImportTransactionErrorLogDto {
    @IsOptional()
    @IsInt()
    id: number;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    importTransactionErrorLogId: string;
    @IsNotEmpty()
    @IsOptional()
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
    @IsOptional()
    @IsString()
    @ApiProperty()
    errorMessage: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    errorTrace: string;
}