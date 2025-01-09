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
import { ViewMetadata } from '../entities/view-metadata.entity';
import { FieldMetadata } from '../entities/field-metadata.entity';
import { ModelMetadata } from '../entities/model-metadata.entity';
import { UpdateViewMetadataDto } from '../dtos/update-view-metadata.dto';
import { ActionMetadataService } from './action-metadata.service';
export declare class ViewMetadataService extends CRUDService<ViewMetadata> {
    readonly modelMetadataService: ModelMetadataService;
    readonly moduleMetadataService: ModuleMetadataService;
    readonly mediaStorageProviderService: MediaStorageProviderMetadataService;
    readonly configService: ConfigService;
    readonly fileService: FileService;
    readonly mediaService: MediaService;
    readonly discoveryService: DiscoveryService;
    readonly crudHelperService: CrudHelperService;
    readonly actionMetadataService: ActionMetadataService;
    readonly entityManager: EntityManager;
    readonly repo: Repository<ViewMetadata>;
    private readonly fieldMetadataRepo;
    private readonly modelMetadataRepo;
    constructor(modelMetadataService: ModelMetadataService, moduleMetadataService: ModuleMetadataService, mediaStorageProviderService: MediaStorageProviderMetadataService, configService: ConfigService, fileService: FileService, mediaService: MediaService, discoveryService: DiscoveryService, crudHelperService: CrudHelperService, actionMetadataService: ActionMetadataService, entityManager: EntityManager, repo: Repository<ViewMetadata>, fieldMetadataRepo: Repository<FieldMetadata>, modelMetadataRepo: Repository<ModelMetadata>);
    getLayout(query: any): Promise<{
        solidView: ViewMetadata;
        solidFieldsMetadata: {
            [k: string]: FieldMetadata;
        };
    }>;
    findOneByUserKey(name: string, relations?: {}): Promise<ViewMetadata>;
    upsert(updateSolidViewDto: UpdateViewMetadataDto): Promise<ViewMetadata>;
}
