import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { Locale } from 'src/entities/locale.entity';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { LocaleRepository } from 'src/repository/locale.repository';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { CRUDService } from 'src/services/crud.service';
import { FileService } from 'src/services/file.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { RequestContextService } from './request-context.service';
@Injectable()
export class LocaleService extends CRUDService<Locale> implements OnApplicationBootstrap{
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(Locale, 'default')
    // readonly repo: Repository<Locale>,
    readonly repo: LocaleRepository,
    // @InjectRepository(Locale, 'default')
    readonly moduleRef: ModuleRef,
    // @InjectRepository(ModelMetadata)
    // private readonly modelMetadataRepo: Repository<ModelMetadata>,
    // private readonly modelMetadataRepo: ModelMetadataRepository,
    readonly requestContextService: RequestContextService,
    readonly solidRegistry: SolidRegistry,
 ) {
   super(modelMetadataService, moduleMetadataService,  configService, fileService,  discoveryService, crudHelperService,entityManager, repo, 'locale', 'solid-core', moduleRef);
 }
  private readonly logger = new Logger(LocaleService.name)
  onApplicationBootstrap() {
    // Load the security rules from the database
    this.loadLocales();
  }
   async loadLocales() {
    const locales = await this.repo.find();
    this.logger.debug(`Loaded ${locales.length} locales into registry`);
    this.solidRegistry.registerlocales(locales);
  }
}
