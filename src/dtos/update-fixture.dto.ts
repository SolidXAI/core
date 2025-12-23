import { IsInt,IsOptional, IsString, IsNotEmpty, IsJSON, ValidateNested, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpdateFixtureModelDto } from 'src/dtos/update-fixture-model.dto';

export class UpdateFixtureDto {
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