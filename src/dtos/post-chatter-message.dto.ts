import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';

export class PostChatterMessageDto {
    @IsNumber()
    @IsNotEmpty()
    coModelEntityId: number;

    @IsString()
    @IsNotEmpty()
    coModelName: string;

    @IsString()
    @IsNotEmpty()
    messageBody: string;

    @IsString()
    @IsOptional()
    messageSubType?: string;

    @IsString()
    @IsOptional()
    modelUserKey?: string;
}