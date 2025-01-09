import { DiscoveryService } from "@nestjs/core";
import { EntityManager, Repository } from 'typeorm';
import { CRUDService } from 'src/services/crud.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { MediaStorageProviderMetadataService } from 'src/services/media-storage-provider-metadata.service';
import { ConfigService } from '@nestjs/config';
import { MediaService } from "src/services/media.service";
import { FileService } from "src/services/file.service";
import { CrudHelperService } from "src/services/crud-helper.service";
import { ActionMetadata } from '../entities/action-metadata.entity';
export declare class ActionMetadataService extends CRUDService<ActionMetadata> {
    readonly modelMetadataService: ModelMetadataService;
    readonly moduleMetadataService: ModuleMetadataService;
    readonly mediaStorageProviderService: MediaStorageProviderMetadataService;
    readonly configService: ConfigService;
    readonly fileService: FileService;
    readonly mediaService: MediaService;
    readonly discoveryService: DiscoveryService;
    readonly crudHelperService: CrudHelperService;
    readonly entityManager: EntityManager;
    readonly repo: Repository<ActionMetadata>;
    constructor(modelMetadataService: ModelMetadataService, moduleMetadataService: ModuleMetadataService, mediaStorageProviderService: MediaStorageProviderMetadataService, configService: ConfigService, fileService: FileService, mediaService: MediaService, discoveryService: DiscoveryService, crudHelperService: CrudHelperService, entityManager: EntityManager, repo: Repository<ActionMetadata>);
    findOneByUserKey(name: string, relations?: {}): Promise<ActionMetadata>;
    upsert(updateSolidActionDto: any): Promise<any>;
}
