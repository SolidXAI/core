import { CommonEntity } from "src/entities/common.entity";
import { MediaStorageProviderMetadata } from "./media-storage-provider-metadata.entity";
import { ModelMetadata } from "./model-metadata.entity";
import { FieldMetadata } from "./field-metadata.entity";
export declare class Media extends CommonEntity {
    entityId: number;
    modelMetadata: ModelMetadata;
    relativeUri: string;
    mediaStorageProviderMetadata: MediaStorageProviderMetadata;
    fieldMetadata: FieldMetadata;
}
