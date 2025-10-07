import { IsOptional, IsString } from 'class-validator';

export class InvokeAiPromptDto {
    @IsString()
    prompt: string;

    @IsOptional()
    @IsString()
    moduleName: string;
}