import { IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateEmailAttachmentDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    displayName: string;

    @IsOptional()
    @IsString()
    relativePath: string;

    @IsOptional()
    @IsString()
    url: string;

    @IsOptional()
    @IsString()
    template: string;

    @IsOptional()
    @IsInt()
    emailTemplateId: number;
}