import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, IsBoolean, IsDate, IsOptional, IsInt } from 'class-validator';

export class CreateScheduledJobDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    scheduleName: string;

    @IsNotEmpty()
    @IsBoolean()
    @ApiProperty()
    isActive: boolean = false;

    @IsNotEmpty()
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