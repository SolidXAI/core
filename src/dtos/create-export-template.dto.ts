import { IsString } from 'class-validator';
import { IsNotEmpty, IsBoolean, IsOptional, IsInt, IsJSON } from 'class-validator';
export class CreateExportTemplateDto {
@IsNotEmpty()
@IsString()
templateName: string;

@IsNotEmpty()
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
@IsJSON()
fields: any;
}