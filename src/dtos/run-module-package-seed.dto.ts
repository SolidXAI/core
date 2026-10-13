import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class RunModulePackageSeedDto {
    @ApiPropertyOptional({
        description: 'Whether to seed global metadata as part of the module seed run.',
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    seedGlobalMetadata?: boolean = false;

    @ApiPropertyOptional({
        description: 'Remove metadata (views, menus, actions, ...) that is no longer present in the module metadata file.',
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    prune?: boolean = false;
}
