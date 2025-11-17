import { Injectable } from '@nestjs/common';
import { MediaStorageProviderMetadata } from 'src/entities/media-storage-provider-metadata.entity';
import { RequestContextService } from 'src/services/request-context.service';
import { DataSource } from 'typeorm';
import { SecurityRuleRepository } from './security-rule.repository';
import { SolidBaseRepository } from './solid-base.repository';

@Injectable()
export class MediaStorageProviderMetadataRepository extends SolidBaseRepository<MediaStorageProviderMetadata> {
    constructor(
        readonly dataSource: DataSource,
        readonly requestContextService: RequestContextService,
        readonly securityRuleRepository: SecurityRuleRepository,
    ) {
        super(MediaStorageProviderMetadata, dataSource, requestContextService, securityRuleRepository);
    }
}