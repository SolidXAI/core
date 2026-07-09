import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsBoolean,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Matches,
    Max,
    Min,
} from "class-validator";
import { DatasourceType } from "./create-model-metadata.dto";

export class CreateDatasourceManagementDto {
    @ApiProperty({ description: "Logical datasource key used in generated filenames and env prefixes." })
    @IsString()
    @Matches(/^[a-z][a-z0-9-]*$/, {
        message: "Datasource name must start with a lower-case letter and use only lower-case letters, numbers, or hyphens.",
    })
    name: string;

    @ApiPropertyOptional({ description: "Human friendly label shown in the admin interface." })
    @IsOptional()
    @IsString()
    displayName?: string;

    @ApiProperty({ enum: [DatasourceType.postgres, DatasourceType.mysql, DatasourceType.mssql] })
    @IsIn([DatasourceType.postgres, DatasourceType.mysql, DatasourceType.mssql])
    type: DatasourceType;

    @ApiProperty()
    @IsString()
    host: string;

    @ApiProperty()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(65535)
    port: number;

    @ApiProperty()
    @IsString()
    database: string;

    @ApiProperty()
    @IsString()
    username: string;

    @ApiProperty()
    @IsString()
    password: string;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    synchronize?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    logging?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    ssl?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    sslRejectUnauthorized?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    poolMax?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    connectionTimeoutMs?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    idleTimeoutMs?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    statementTimeoutMs?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    idleInTxTimeoutMs?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    retryAttempts?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    retryDelayMs?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    encrypt?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    trustServerCertificate?: boolean;
}
