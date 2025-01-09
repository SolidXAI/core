import { CommonEntity } from "src/entities/common.entity";
import { ModelMetadata } from "./model-metadata.entity";
export declare class ModuleMetadata extends CommonEntity {
    displayName: string;
    name: string;
    description: string;
    menuIconUrl: string;
    menuSequenceNumber: number;
    defaultDataSource: string;
    models: ModelMetadata[];
    isSystem: boolean;
}
