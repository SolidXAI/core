import { IsInt,IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDashboardUserLayoutDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    userId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    userUserKey: string;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    moduleId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    moduleUserKey: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    dashboardName: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    layoutJson: string;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    version: number;
}