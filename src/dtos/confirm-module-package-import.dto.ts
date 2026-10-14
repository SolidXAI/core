import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ConfirmModulePackageImportDto {
    @ApiPropertyOptional({
        description: 'Allow overwriting an existing module folder in solid-api and solid-ui.',
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    overwriteExisting?: boolean = false;

    @ApiPropertyOptional({
        description: 'Update mode only. The incoming package version the user approved; must match the previewed version (null for an unversioned package).',
        nullable: true,
    })
    @IsOptional()
    @IsString()
    confirmedVersion?: string | null;

    @ApiPropertyOptional({
        description: 'Update mode only. Required when the update is a reinstall, a downgrade or a legacy (unversioned) package.',
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    acknowledgeVersionChange?: boolean = false;
}
