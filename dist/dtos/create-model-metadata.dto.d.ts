import { CreateFieldMetadataDto } from "./create-field-metadata.dto";
export declare enum DatasourceType {
    mysql = "mysql",
    postgres = "postgres",
    mssql = "mssql",
    oracle = "oracle",
    mariadb = "mariadb"
}
export declare class CreateModelMetadataDto {
    readonly singularName: string;
    readonly tableName?: string;
    readonly pluralName: string;
    readonly displayName: string;
    readonly description: string;
    readonly dataSource: string;
    readonly dataSourceType: string;
    readonly enableSoftDelete: boolean;
    readonly enableAuditTracking: boolean;
    readonly internationalisation: boolean;
    moduleId: number;
    moduleUserKey?: string;
    userKeyFieldId: number;
    userKeyFieldUserKey?: string;
    fields: CreateFieldMetadataDto[];
    readonly isExportable: boolean;
    isSystem: boolean;
}
