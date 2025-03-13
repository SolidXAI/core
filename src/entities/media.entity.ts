import { CommonEntity } from "src/entities/common.entity";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { MediaStorageProviderMetadata } from "./media-storage-provider-metadata.entity";
import { ModelMetadata } from "./model-metadata.entity";
import Joi from "@hapi/joi";
import { FieldMetadata } from "./field-metadata.entity";

@Entity("ss_media")
export class Media extends CommonEntity {
    @Index()
    @Column({ name: "entity_id" })
    entityId: number;

    @Index()
    @ManyToOne(() => ModelMetadata)
    @JoinColumn({ name: "model_metadata_id" })
    modelMetadata: ModelMetadata;

    @Column({ name: "relative_uri" })
    relativeUri: string;

    @Column({ name: "mime_type" })
    mimeType: string = "application";

    @Column({ name: "file_size" })
    fileSize: number = 0;

    @Column({ name: "original_file_name" })
    originalFileName: string = "NA";

    @Index()
    @ManyToOne(() => MediaStorageProviderMetadata)
    @JoinColumn({ name: "media_storage_provider_metadata_id" })
    mediaStorageProviderMetadata: MediaStorageProviderMetadata;

    @Index()
    @ManyToOne(() => FieldMetadata)
    @JoinColumn({ name: "field_metadata_id" })
    fieldMetadata: FieldMetadata;
}