import { IsOptional, IsString } from 'class-validator';
import { Matches } from 'class-validator';
import { IsNotEmpty, IsJSON } from 'class-validator';
export class CreateViewMetadataDto {
    @IsNotEmpty()
    @Matches(/[a-z]+(-[a-z]+)*/, { message: "Only kebab case allowed for module name, also only lower case." })
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    displayName: string;

    @IsNotEmpty()
    @IsString()
    type: string;

    @IsNotEmpty()
    @IsJSON()
    context: any;

    @IsNotEmpty()
    @IsJSON()
    layout: any;

    @IsNotEmpty()
    moduleId: number;

    @IsString()
    @IsOptional()
    moduleUserKey: string;

    @IsNotEmpty()
    modelId: number;

    @IsString()
    @IsOptional()
    modelUserKey: string;
}