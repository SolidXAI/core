import { IsInt, IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmailAttachmentDto {
    @IsNotEmpty()
    @Matches(/[a-z]+(-[a-z]+)*/)
    @IsString()
    @ApiProperty()
    name: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    displayName: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    relativePath: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    url: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    template: string;
    @IsOptional()
    @IsInt()
    emailTemplateId: number;
}