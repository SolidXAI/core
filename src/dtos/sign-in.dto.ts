import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class SignInDto {

    @ApiProperty({ default: 'sa@solidxai.com' })
    @IsEmail()
    // @IsNotEmpty()
    @IsOptional()
    email: string;
    
    @ApiProperty({ default: 'sa' })
    @IsString()
    // @IsNotEmpty()
    @IsOptional()
    username: string;

    @ApiProperty({ default: '' })
    @IsOptional()
    password: string;
}
