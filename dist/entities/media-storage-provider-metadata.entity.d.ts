import { CommonEntity } from "src/entities/common.entity";
export declare class MediaStorageProviderMetadata extends CommonEntity {
    name: string;
    type: string;
    region: string;
    bucketName: string;
    isPublic: boolean;
    localPath: string;
}
