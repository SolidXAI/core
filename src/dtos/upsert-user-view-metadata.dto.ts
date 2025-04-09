import { IsInt, IsOptional, IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertUserViewMetadataDto {
    @IsOptional()
    @IsInt()
    @ApiProperty()
    userId: number;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    viewMetadataId: number;
    @IsOptional()
    @IsJSON()
    @ApiProperty()
    layout: any;
}