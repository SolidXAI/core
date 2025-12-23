import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, IsOptional, IsJSON } from 'class-validator';

export class CreateFixturesDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    moduleName: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    scenarioName: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    scenarioDescription: string;
    @IsNotEmpty()
    @IsJSON()
    @ApiProperty()
    data: any;
}