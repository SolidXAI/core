import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsNotEmpty, IsInt, IsOptional } from 'class-validator';

export class CreateChatterMessageDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    messageType: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    messageSubType: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    messageBody: string;
    @IsNotEmpty()
    @IsInt()
    @ApiProperty()
    coModelEntityId: number;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    coModelName: string;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    userId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    userUserKey: string;
}