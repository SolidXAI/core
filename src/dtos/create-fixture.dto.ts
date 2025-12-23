import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, IsOptional, IsJSON, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateFixtureModelDto } from 'src/dtos/update-fixture-model.dto';

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
    @IsOptional()
    @ApiProperty()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateFixtureModelDto)
    fixtureModels: UpdateFixtureModelDto[];
    @IsOptional()
    @IsArray()
    @ApiProperty()
    fixtureModelsIds: number[];
    @IsString()
    @IsOptional()
    @ApiProperty()
    fixtureModelsCommand: string;
}