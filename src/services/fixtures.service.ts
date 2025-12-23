import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { DiscoveryService, ModuleRef  } from "@nestjs/core";
import { EntityManager } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { ConfigService } from '@nestjs/config';
import { FileService } from 'src/services/file.service';
import { CrudHelperService } from 'src/services/crud-helper.service';

import { Fixtures } from '../entities/fixtures.entity';
import { FixturesRepository } from '../repositories/fixtures.repository';

@Injectable()
export class FixturesService extends CRUDService<Fixtures>{
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager("default")
    readonly entityManager: EntityManager,
    readonly repo: FixturesRepository,
    readonly moduleRef: ModuleRef

 ) {
   super(modelMetadataService, moduleMetadataService,  configService, fileService,  discoveryService, crudHelperService,entityManager, repo, 'fixtures', 'solid-core', moduleRef);
 }
}
