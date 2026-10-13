import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ValidateModulePackageImportDto {
    @ApiPropertyOptional({
        description: 'When updating a specific module, the module name the uploaded package must match.',
    })
    @IsOptional()
    @IsString()
    expectedModuleName?: string;
}
