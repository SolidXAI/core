import { IsInt,IsOptional, IsString, IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserViewMetadataDto {
    @IsOptional()
    @IsInt()
    id: number;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    userId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    userUserKey: string;
    @IsOptional()
    @IsJSON()
    @ApiProperty()
    layout: any;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    viewMetadataId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    viewMetadataUserKey: string;
}