import { IsInt, IsOptional, IsString, Matches, IsNotEmpty, IsJSON, IsBoolean } from 'class-validator';
export class UpdateActionMetadataDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsOptional()
    @IsNotEmpty()
    @Matches(/[a-z]+(-[a-z]+)*/)
    @IsString()
    name: string;

    @IsOptional()
    @IsNotEmpty()
    @IsString()
    displayName: string;

    @IsOptional()
    @IsNotEmpty()
    @IsString()
    type: string;

    @IsOptional()
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

    @IsOptional()
    @IsNotEmpty()
    moduleId: number;

    @IsString()
    @IsOptional()
    moduleUserKey: string;

    @IsOptional()
    @IsNotEmpty()
    modelId: number;

    @IsString()
    @IsOptional()
    modelUserKey: string;

    @IsOptional()
    @IsNotEmpty()
    viewId: number;

    @IsString()
    @IsOptional()
    viewUserKey: string;
}