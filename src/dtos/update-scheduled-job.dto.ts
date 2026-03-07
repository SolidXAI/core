import { IsInt, IsOptional, IsString, IsNotEmpty, IsBoolean, IsDate } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateScheduledJobDto {
    @IsOptional()
    @IsInt()
    id: number;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    scheduleName: string;

    @IsNotEmpty()
    @IsOptional()
    @IsBoolean()
    @ApiProperty()
    isActive: boolean;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    frequency: string;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    startTime: Date;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    endTime: Date;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    startDate: Date;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    endDate: Date;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    dayOfMonth: number;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    lastRunAt: Date;

    @IsOptional()
    @IsDate()
    @ApiProperty()
    nextRunAt: Date;

    @IsOptional()
    @IsString()
    @ApiProperty()
    dayOfWeek: string;

    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    job: string;

    @IsOptional()
    @IsString()
    @ApiProperty()
    cronExpression: string;

    @IsOptional()
    @IsInt()
    @ApiProperty()
    moduleId: number;

    @IsString()
    @IsOptional()
    @ApiProperty()
    moduleUserKey: string;
}