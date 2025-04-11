import { IsArray, IsBoolean, IsEmail, IsNotEmpty, IsOptional, MaxLength, MinLength, ValidateNested, Matches, IsString } from 'class-validator';
import { CreateEmailAttachmentDto } from './create-email-attachment.dto';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmailTemplateDto {
    @IsNotEmpty()
    @Matches(/[a-z]+(-[a-z]+)*/)
    @IsString()
    @ApiProperty()
    name: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    displayName: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    body: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    subject: string = "{}";
    @IsOptional()
    @IsString()
    @ApiProperty()
    description: string;
    @IsOptional()
    @IsBoolean()
    @ApiProperty()
    active: boolean = true;
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateEmailAttachmentDto)
    attachments: CreateEmailAttachmentDto[];
    @IsOptional()
    @IsString()
    @ApiProperty()
    type: string;
}
