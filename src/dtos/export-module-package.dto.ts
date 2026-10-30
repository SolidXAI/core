import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export const MODULE_PACKAGE_VERSION_BUMPS = ['none', 'patch', 'minor', 'major'] as const;
export type ModulePackageVersionBump = typeof MODULE_PACKAGE_VERSION_BUMPS[number];

export class ExportModulePackageDto {
    @ApiPropertyOptional({
        description: 'How to bump the module version before exporting. Ignored when version is provided.',
        enum: MODULE_PACKAGE_VERSION_BUMPS,
        default: 'none',
    })
    @IsOptional()
    @IsIn(MODULE_PACKAGE_VERSION_BUMPS)
    bump?: ModulePackageVersionBump = 'none';

    @ApiPropertyOptional({
        description: 'Explicit semver version to export with, e.g. the initial version of an unversioned module.',
    })
    @IsOptional()
    @IsString()
    version?: string;
}
