import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString, IsNotEmpty, IsJSON } from 'class-validator';

export class CreateFixturesModelsDto {
    @IsOptional()
    @IsInt()
    @ApiProperty()
    fixtureId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    fixtureUserKey: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    modelName: string;
    @IsNotEmpty()
    @IsJSON()
    @ApiProperty()
    modelData: any;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    modelId: number;
}