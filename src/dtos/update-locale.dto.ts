import { IsString, IsBoolean, IsOptional, IsInt, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLocaleDto {
    @IsOptional()
    @IsInt()
    id: number;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    locale: string;
    @IsNotEmpty()
    @IsOptional()
    @IsString()
    @ApiProperty()
    displayName: string;
    @IsNotEmpty()
    @IsOptional()
    @IsBoolean()
    @ApiProperty()
    isDefault: boolean;
}
