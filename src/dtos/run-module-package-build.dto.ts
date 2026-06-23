import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class RunModulePackageBuildDto {
    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    buildSolidApi?: boolean = true;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    buildSolidUi?: boolean = true;
}
