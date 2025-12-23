import { IsInt,IsOptional, IsString, IsNotEmpty, IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFixturesDto {
    @IsOptional()
    @IsInt()
    id: number;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    moduleName: string;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    scenarioName: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    scenarioDescription: string;
    @IsNotEmpty()
    @IsOptional()
    @IsJSON()
    @ApiProperty()
    data: any;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    status: string;
}