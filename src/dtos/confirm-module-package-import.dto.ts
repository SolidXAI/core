import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ConfirmModulePackageImportDto {
    @ApiPropertyOptional({
        description: 'Allow overwriting an existing module folder in solid-api and solid-ui.',
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    overwriteExisting?: boolean = false;
}
