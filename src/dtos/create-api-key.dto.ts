import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateApiKeyDto {
    @ApiProperty({ example: 'Production Server' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z' })
    @IsDateString()
    @IsOptional()
    expiresAt?: string;
}
