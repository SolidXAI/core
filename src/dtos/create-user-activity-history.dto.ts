import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsString } from 'class-validator';
export class CreateUserActivityHistoryDto {
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