import { IsNotEmpty, IsNumber, IsString, IsOptional, IsDate } from 'class-validator';

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
    messageBodyMentions?: string;

    @IsString()
    @IsOptional()
    messageSubType?: string;

    @IsString()
    @IsOptional()
    modelUserKey?: string;

    @IsString()
    @IsOptional()
    status?: string;

    @IsDate()
    @IsOptional()
    createdAt?: Date;
}