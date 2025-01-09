import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateShortUrlDto {
    @IsString()
    @IsNotEmpty()
    url: string;

    @IsString()
    @IsOptional()
    domain: string;

    @IsString()
    @IsOptional()
    description: string;

    @IsString({ each: true })
    tags: string[];
}