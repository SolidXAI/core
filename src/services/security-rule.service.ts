import { forwardRef, Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef } from "@nestjs/core";
import { EntityManager } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';


import { SecurityRule } from '../entities/security-rule.entity';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { SecurityRuleRepository } from '../repository/security-rule.repository';

@Injectable()
export class SecurityRuleService extends CRUDService<SecurityRule> implements OnApplicationBootstrap {
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(SecurityRule, 'default')
    // readonly repo: Repository<SecurityRule>,
    @Inject(forwardRef(() => SecurityRuleRepository))
    readonly repo: SecurityRuleRepository,
    readonly moduleRef: ModuleRef,
    readonly solidRegistry: SolidRegistry,

  ) {
    super(entityManager, repo, 'securityRule', 'solid-core', moduleRef);
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
