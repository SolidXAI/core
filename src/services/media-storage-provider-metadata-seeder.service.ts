import { Injectable, Logger } from '@nestjs/common';
import { MediaStorageProviderMetadataService } from './media-storage-provider-metadata.service';



/**
 * solid seed -s ModuleMetadataSeederService
 */
@Injectable()
export class MediaStorageProviderMetadataSeederService {
    private readonly logger = new Logger(MediaStorageProviderMetadataSeederService.name);

    constructor(
        private readonly mediaStorageProviderMetadataService: MediaStorageProviderMetadataService,
    ) { }

    async seed() {
        const existingDefaultFs = await this.mediaStorageProviderMetadataService.findOneByUserKey('default-filesystem');
        if (!existingDefaultFs) {
            await this.mediaStorageProviderMetadataService.create({
                name: 'default-filesystem',
                type: 'filesystem'
            });
        }
        const existingDefaultAws = await this.mediaStorageProviderMetadataService.findOneByUserKey('default-aws-s3');
        if (!existingDefaultAws) {
            await this.mediaStorageProviderMetadataService.create({
                name: 'default-aws-s3',
                type: 'aws-s3'
            });
        }
    }
}