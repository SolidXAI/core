import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { DiscoveryService, ModuleRef  } from "@nestjs/core";
import { EntityManager, Repository } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { ConfigService } from '@nestjs/config';
import { FileService } from 'src/services/file.service';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { ModelMetadata } from 'src/entities/model-metadata.entity';
import { RequestContextService } from './request-context.service';
import { Locale } from 'src/entities/locale.entity';
@Injectable()
export class LocaleService extends CRUDService<Locale>{
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectRepository(Locale, 'default')
    readonly repo: Repository<Locale>,
    @InjectRepository(Locale, 'default')
    readonly moduleRef: ModuleRef,
    @InjectRepository(ModelMetadata)
    private readonly modelMetadataRepo: Repository<ModelMetadata>,
    readonly requestContextService: RequestContextService
 ) {
   super(modelMetadataService, moduleMetadataService,  configService, fileService,  discoveryService, crudHelperService,entityManager, repo, 'locale', 'solid-core', moduleRef);
 }

}
