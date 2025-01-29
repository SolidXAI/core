import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class SignInDto {

    @ApiProperty({ default: 'admin@example.service.com' })
    @IsEmail()
    // @IsNotEmpty()
    @IsOptional()
    email: string;
    
    @ApiProperty({ default: 'admin@example.service.com' })
    @IsString()
    // @IsNotEmpty()
    @IsOptional()
    username: string;

    @ApiProperty({ default: 'Admin@3214$' })
    @IsOptional()
    password: string;
}
