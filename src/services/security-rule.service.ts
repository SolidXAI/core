import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { EntityManager, Repository } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { ConfigService } from '@nestjs/config';
import { FileService } from 'src/services/file.service';
import { CrudHelperService } from 'src/services/crud-helper.service';


import { SecurityRule } from '../entities/security-rule.entity';
import { SolidRegistry } from 'src/helpers/solid-registry';

@Injectable()
export class SecurityRuleService extends CRUDService<SecurityRule> implements OnApplicationBootstrap {
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectRepository(SecurityRule, 'default')
    readonly repo: Repository<SecurityRule>,
    readonly moduleRef: ModuleRef,
    readonly solidRegistry: SolidRegistry,

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'securityRule', 'solid-core', moduleRef);
  }

  onApplicationBootstrap() {
    // Load the security rules from the database
    this.loadSecurityRules();
  }

  async loadSecurityRules() {
    const securityRules = await this.repo.find(
      {
        relations: {
          modelMetadata: true,
          role: true,
        }
      }
    );
    this.solidRegistry.registerSecurityRules(securityRules);
  }

}
