import { IsInt, IsOptional, IsString, Matches, IsNotEmpty, IsJSON } from 'class-validator';
export class UpdateViewMetadataDto {
    @IsOptional()
    @IsInt()
    id: number;

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