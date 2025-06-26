import { IsInt,IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class UpdateUserActivityHistoryDto {
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
@IsString()
@ApiProperty()
event: string;

@IsOptional()
@IsString()
@ApiProperty()
ipAddress: string;

@IsOptional()
@IsString()
@ApiProperty()
userAgent: string;
}