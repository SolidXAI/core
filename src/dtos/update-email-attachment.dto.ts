import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Matches } from 'class-validator';
import { IsOptional } from 'class-validator';
import { IsNotEmpty } from 'class-validator';
export class UpdateEmailAttachmentDto {


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

@IsOptional()
@IsString()
@ApiProperty()
relativePath: string;

@IsOptional()
@IsString()
@ApiProperty()
url: string;

@IsOptional()
@IsString()
@ApiProperty()
template: string;
}