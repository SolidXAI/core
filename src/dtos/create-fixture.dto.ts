import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, IsOptional, IsJSON } from 'class-validator';

export enum FixtureStatus {
    IN_PROGRESS = 'inProgress',
    APPLIED = 'applied',
    FAILED = 'failed',
}
export class CreateFixtureDto {
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
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    status: string;
}