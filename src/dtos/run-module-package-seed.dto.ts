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
}
