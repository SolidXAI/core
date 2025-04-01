import { IsInt,IsOptional, IsString, IsNotEmpty, IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSecurityRuleDto {
    @IsOptional()
    @IsInt()
    id: number;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    name: string;
    @IsNotEmpty()
    @IsOptional()
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
    @IsOptional()
    @IsJSON()
    @ApiProperty()
    securityRule: any;
}