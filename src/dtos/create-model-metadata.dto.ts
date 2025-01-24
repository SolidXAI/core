import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, ValidateNested } from "class-validator";
import { CreateFieldMetadataDto } from "./create-field-metadata.dto";
import { IsNotInEnum } from "src/decorators/is-not-in-enum.decorator";
import { RESERVED_SOLID_KEYWORDS } from "src/helpers/solid-registry";

export enum DatasourceType {
    // numeric types
    // mongodb = 'mongodb',
    // rdbms = 'rdbms',

    mysql = 'mysql',
    postgres = 'postgres',
    mssql = 'mssql',
    oracle = 'oracle',
    mariadb = 'mariadb',
}

export class CreateModelMetadataDto {
    @ApiProperty({ description: "Display name of your model" })
    @Matches(/[a-z]+(-[a-z]+)*/, {
        message: "Model name should follow snake case conventions only with all lower case."
    })
    @IsNotInEnum(RESERVED_SOLID_KEYWORDS)
    readonly singularName: string;

    @ApiProperty({ description: "Name of your module" })
    @Matches(/[a-z]+(_[a-z]+)*/, {
        message: "Only snake case allowed for module table name, also only lower case."
    })
    @IsOptional()
    readonly tableName?: string;

    @ApiProperty({ description: "Display name of your model" })
    @Matches(/[a-z]+(-[a-z]+)*/, {
        message: "Model name should follow snake case conventions only with all lower case."
    })
    readonly pluralName: string;

    @ApiProperty({ description: "Display name of your model" })
    @IsString()
    readonly displayName: string;

    @ApiProperty({ description: "Describe your model" })
    @IsString()
    readonly description: string;

    @ApiProperty({ description: "The data source to use with this model" })
    // @IsEnum(DataSource)
    @IsString()
    readonly dataSource: string;

    @ApiProperty({ description: "You can have models linked to MongoDB or to an RDBMS" })
    @IsString()
    readonly dataSourceType: string;

    @ApiProperty({ description: "Enable Soft Delete" })
    @IsBoolean()
    readonly enableSoftDelete: boolean;

    @ApiProperty({ description: "Enable Soft Delete" })
    @IsBoolean()
    readonly enableAuditTracking: boolean

    @ApiProperty({ description: "Enable Soft Delete" })
    @IsBoolean()
    readonly internationalisation: boolean

    @ApiProperty({ description: "Related module id" })
    @IsInt()
    @IsOptional()
    moduleId: number;

    @IsString()
    @IsOptional()
    moduleUserKey?: string;

    @ApiProperty({ description: "Related user key field id" })
    @IsInt()
    @IsOptional()
    userKeyFieldId: number;

    @IsString()
    @IsOptional()
    userKeyFieldUserKey?: string;

    @ApiProperty({ description: "Fields associated with this model" })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateFieldMetadataDto)
    fields: CreateFieldMetadataDto[];

    @ApiProperty({ description: "Is Exportable" })
    @IsBoolean()
    readonly isExportable: boolean

    @ApiProperty({ description: 'System models are not included in the code generation, the assumption being that system models have manually written code.', })
    @IsBoolean()
    isSystem: boolean;
}
