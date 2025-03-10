import { CommonEntity } from "src/entities/common.entity";
import { Column, Entity, Index } from "typeorm";

@Entity("ss_media_storage_provider_metadata")
export class MediaStorageProviderMetadata extends CommonEntity {
    @Index({ unique: true })
    @Column({ })
    name: string;

    @Column()
    type: string;

    @Column({ nullable: true })
    region: string;

    @Column({ name: "bucket_name", nullable: true })
    bucketName: string;

    @Column({ name: "is_public", nullable: true })
    isPublic: boolean;

    @Column({ name: "local_path", nullable: true })
    localPath: string;
}