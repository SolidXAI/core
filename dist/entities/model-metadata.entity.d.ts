import { CommonEntity } from "src/entities/common.entity";
import { FieldMetadata } from "./field-metadata.entity";
import { ModuleMetadata } from "./module-metadata.entity";
export declare class ModelMetadata extends CommonEntity {
    singularName: string;
    tableName: string;
    pluralName: string;
    displayName: string;
    description: string;
    dataSource: string;
    dataSourceType: string;
    enableSoftDelete: boolean;
    enableAuditTracking: boolean;
    internationalisation: boolean;
    fields: FieldMetadata[];
    module: ModuleMetadata;
    isExportable: boolean;
    userKeyField: FieldMetadata;
    isSystem: boolean;
}
