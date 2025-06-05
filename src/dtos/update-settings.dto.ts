import { IsObject, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
    @IsOptional()
    settings: Record<string, any>;
} 