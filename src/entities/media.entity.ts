import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';
import { FieldMetadata } from 'src/entities/field-metadata.entity'
@Entity("ss_media")
export class Media extends CommonEntity {
    @Index()
    @Column({ type: "integer" })
    entityId: number;

    @Column({ type: "varchar", nullable: true })
    relativeUri: string;

    @Index()
    @Column({ type: "integer", nullable: true })
    fileSize: number;

    @Column({ type: "varchar", nullable: true })
    mimeType: string;

    @Column({ type: "varchar", nullable: true })
    originalFileName: string;

    @Index()
    @ManyToOne(() => ModelMetadata, { nullable: false })
    @JoinColumn()
    modelMetadata: ModelMetadata;

    @Index()
    @ManyToOne(() => MediaStorageProviderMetadata, { nullable: false })
    @JoinColumn()
    mediaStorageProviderMetadata: MediaStorageProviderMetadata;

    @Index()
    @ManyToOne(() => FieldMetadata, { nullable: false })
    @JoinColumn()
    fieldMetadata: FieldMetadata;
}