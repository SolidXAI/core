import { Injectable } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { CRUDService } from 'src/services/crud.service';
import { EntityManager, In } from 'typeorm';


import { PermissionMetadataRepository } from 'src/repository/permission-metadata.repository';
import { PermissionMetadata } from '../entities/permission-metadata.entity';

@Injectable()
export class PermissionMetadataService extends CRUDService<PermissionMetadata> {
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(PermissionMetadata, 'default')
    // readonly repo: Repository<PermissionMetadata>,
    readonly repo: PermissionMetadataRepository,
    readonly moduleRef: ModuleRef

  ) {
    super(entityManager, repo, 'permissionMetadata', 'solid-core',moduleRef);
  }


  findAllUsingRoles(roles: string[]) {
    return this.repo.find({
      where: {
        roles: {
          name: In(roles)
        }
      },
      relations: {}
    });
  }

  permissionExistsInRole(role: string, permission: string,) {
    return this.repo.find({
      where: {
        name: permission,
        roles: {
          name: role
        }
      },
      relations: {}
    });
  }

}


