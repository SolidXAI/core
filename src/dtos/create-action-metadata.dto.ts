import { IsString } from 'class-validator';
import { Matches } from 'class-validator';
import { IsNotEmpty, IsJSON, IsOptional, IsBoolean } from 'class-validator';
export class CreateActionMetadataDto {
    @IsNotEmpty()
    @Matches(/[a-z]+(-[a-z]+)*/)
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    displayName: string;

    @IsNotEmpty()
    @IsString()
    type: string;

    @IsOptional()
    @IsJSON()
    domain: any;

    @IsOptional()
    @IsJSON()
    context: any;

    @IsOptional()
    @IsString()
    customComponent: string;

    @IsOptional()
    @IsBoolean()
    customIsModal: boolean;

    @IsOptional()
    @IsString()
    serverEndpoint: string;

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

    @IsNotEmpty()
    viewId: number;

    @IsString()
    @IsOptional()
    viewUserKey: string;
}