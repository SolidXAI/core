import { IsString, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLocaleDto {
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    locale: string;
    @IsNotEmpty()
    @IsString()
    @ApiProperty()
    displayName: string;
    @IsNotEmpty()
    @IsBoolean()
    @ApiProperty()
    isDefault: boolean = true;
}
