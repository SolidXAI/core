import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString, IsJSON } from 'class-validator';

export class CreateUserViewMetadataDto {
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
    layout: any = "{}";
    @IsOptional()
    @IsInt()
    @ApiProperty()
    viewMetadataId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    viewMetadataUserKey: string;
}