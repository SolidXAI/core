import { IsInt, IsOptional, IsString, Matches, IsNotEmpty, IsJSON } from 'class-validator';
export class UpdateViewMetadataDto {
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
    @IsNotEmpty()
    @IsJSON()
    context: any;

    @IsOptional()
    @IsNotEmpty()
    @IsJSON()
    layout: any;

    @IsOptional()
    @IsNotEmpty()
    moduleId: number;

    @IsOptional()
    @IsString()
    @IsOptional()
    moduleUserKey: string;

    @IsOptional()
    @IsNotEmpty()
    modelId: number;

    @IsOptional()
    @IsString()
    @IsOptional()
    modelUserKey: string;
}