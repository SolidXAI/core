import { IsInt, IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingDto {
    @IsOptional()
    @IsInt()
    id: number;
    @IsOptional()
    @IsString()
    @ApiProperty()
    key: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    value: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    type: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    level: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    namespace: string;
    @IsOptional()
    @IsInt()
    @ApiProperty({ description: "This is the user id field" })
    userId: number;
    @IsString()
    @IsOptional()
    @ApiProperty({ description: "This is the user id field" })
    userUserKey: string;
}