import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsOptional, IsJSON, IsInt, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateImportTransactionErrorLogDto } from 'src/dtos/update-import-transaction-error-log.dto';

export class CreateImportTransactionDto {
    @IsOptional()
    @IsString()
    @ApiProperty()
    status: string = "draft";
    @IsOptional()
    @IsString()
    @ApiProperty()
    importTransactionId: string;
    @IsOptional()
    @IsJSON()
    @ApiProperty()
    mapping: any;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    modelMetadataId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    modelMetadataUserKey: string;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    moduleMetadataId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    moduleMetadataUserKey: string;
    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateImportTransactionErrorLogDto)
    importTransactionErrorLog: UpdateImportTransactionErrorLogDto[];
    @IsOptional()
    @IsArray()
    @ApiProperty()
    importTransactionErrorLogIds: number[];
    @IsString()
    @IsOptional()
    @ApiProperty()
    importTransactionErrorLogCommand: string;
}