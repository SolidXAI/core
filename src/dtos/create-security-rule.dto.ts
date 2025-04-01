import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, IsInt, IsOptional, IsJSON } from 'class-validator';

export class CreateSecurityRuleDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    name: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    description: string;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    roleId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    roleUserKey: string;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    modelMetadataId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    modelMetadataUserKey: string;
    @IsNotEmpty()
    @IsJSON()
    @ApiProperty()
    securityRule: any;
}