import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateDashboardUserLayoutDto {
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
    @IsString()
    @ApiProperty()
    dashboardName: string;

    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    layoutJson: string;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    version: number;
}