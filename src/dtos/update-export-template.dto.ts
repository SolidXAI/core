import { IsInt,IsOptional, IsString, IsNotEmpty, IsBoolean, IsJSON } from 'class-validator';
export class UpdateExportTemplateDto {
    @IsOptional()
    @IsInt()
    id: number;

@IsNotEmpty()
@IsOptional()
@IsString()
templateName: string;

@IsNotEmpty()
@IsOptional()
@IsString()
templateFormat: string;

@IsOptional()
@IsBoolean()
notifyOnEmail: boolean = true;

@IsOptional()
@IsInt()
modelIdId: number;

@IsString()
@IsOptional()
modelIdUserKey: string;

@IsNotEmpty()
@IsOptional()
@IsJSON()
fields: any;
}