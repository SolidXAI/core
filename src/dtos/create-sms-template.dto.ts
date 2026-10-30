import { IsEmail, IsNotEmpty, IsOptional, MaxLength, MinLength, IsString, Matches, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSmsTemplateDto {
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
    body: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    smsProviderTemplateId: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    description: string;

    @IsOptional()
    @IsBoolean()
    @ApiProperty()
    active: boolean = true;

    @IsOptional()
    @IsString()
    @ApiProperty()
    type: string;

    @IsOptional()
    @IsInt()
    @ApiProperty({ required: false, description: 'Related module id' })
    moduleId?: number;

    @IsOptional()
    @IsString()
    @ApiProperty({ required: false, description: 'Related module user key' })
    moduleUserKey?: string;
}
