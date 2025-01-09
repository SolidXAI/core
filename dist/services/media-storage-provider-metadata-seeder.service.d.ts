import { MediaStorageProviderMetadataService } from './media-storage-provider-metadata.service';
export declare class MediaStorageProviderMetadataSeederService {
    private readonly mediaStorageProviderMetadataService;
    private readonly logger;
    constructor(mediaStorageProviderMetadataService: MediaStorageProviderMetadataService);
    seed(): Promise<void>;
}
