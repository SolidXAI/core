import { Injectable } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { CRUDService } from 'src/services/crud.service';
import { FileService } from 'src/services/file.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';


import { SavedFiltersRepository } from 'src/repository/saved-filters.repository';
import { SavedFilters } from '../entities/saved-filters.entity';

@Injectable()
export class SavedFiltersService extends CRUDService<SavedFilters>{
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(SavedFilters, 'default')
    // readonly repo: Repository<SavedFilters>,
    readonly repo: SavedFiltersRepository,
    readonly moduleRef: ModuleRef

 ) {
   super(modelMetadataService, moduleMetadataService,  configService, fileService,  discoveryService, crudHelperService,entityManager, repo, 'savedFilters', 'solid-core', moduleRef);
 }
}
