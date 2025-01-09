import { CreateModelMetadataDto } from "./create-model-metadata.dto";
export declare class CreateModuleMetadataDto {
    readonly name: string;
    readonly displayName: string;
    readonly description: string;
    menuIconUrl: string;
    readonly defaultDataSource: string;
    models: CreateModelMetadataDto[];
    isSystem: boolean;
    menuSequenceNumber?: number;
}
