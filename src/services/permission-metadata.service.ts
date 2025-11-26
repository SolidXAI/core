import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { EntityManager, In, Repository } from 'typeorm';
import { CRUDService } from 'src/services/crud.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { ConfigService } from '@nestjs/config';
import { FileService } from "src/services/file.service";
import { CrudHelperService } from "src/services/crud-helper.service";


import { PermissionMetadata } from '../entities/permission-metadata.entity';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { classify } from '@angular-devkit/core/src/utils/strings';
import { PermissionMetadataRepository } from 'src/repository/permission-metadata.repository';

@Injectable()
export class PermissionMetadataService extends CRUDService<PermissionMetadata> {
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(PermissionMetadata, 'default')
    // readonly repo: Repository<PermissionMetadata>,
    readonly repo: PermissionMetadataRepository,
    readonly moduleRef: ModuleRef
  
  ) {
    super(modelMetadataService, moduleMetadataService,  configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'permissionMetadata', 'solid-core',moduleRef);
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


