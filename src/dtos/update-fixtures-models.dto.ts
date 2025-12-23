import { IsInt,IsOptional, IsString, IsNotEmpty, IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFixturesModelsDto {
    @IsOptional()
    @IsInt()
    id: number;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    fixtureId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    fixtureUserKey: string;
    @IsNotEmpty()
    @IsOptional()
    @IsJSON()
    @ApiProperty()
    modelData: any;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    modelId: number;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    modelSingularName: string;
}