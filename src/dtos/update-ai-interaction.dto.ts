import { IsInt,IsOptional, IsString, IsNotEmpty, IsJSON, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAiInteractionDto {
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
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    threadId: string;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    role: string;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    message: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    contentType: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    status: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    errorMessage: string;
    @IsOptional()
    @IsString()
    @ApiProperty()
    modelUsed: string;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    responseTimeMs: number;
    @IsOptional()
    @IsJSON()
    @ApiProperty()
    metadata: any;
    @IsOptional()
    @IsBoolean()
    @ApiProperty()
    isApplied: boolean;
    @IsOptional()
    @IsInt()
    @ApiProperty()
    parentInteractionId: number;
    @IsString()
    @IsOptional()
    @ApiProperty()
    parentInteractionUserKey: string;
}