import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateEmailTemplateDto } from './create-email-template.dto';
import { IsString } from 'class-validator';
import { Matches } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsNotEmpty, IsBoolean } from 'class-validator';

export class UpdateEmailTemplateDto extends PartialType(CreateEmailTemplateDto) {
    @IsNotEmpty()
    @IsOptional()
    @Matches(/[a-z]+(-[a-z]+)*/)
    @IsString()
    @ApiProperty()
    name: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    displayName: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    body: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    type: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    subject: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    description: string;

    @IsOptional()
    @IsBoolean()
    @ApiProperty()
    active: boolean;
} { }
