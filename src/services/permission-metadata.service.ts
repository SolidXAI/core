import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { CrudHelperService } from "src/services/crud-helper.service";
import { CRUDService } from 'src/services/crud.service';
import { FileService } from "src/services/file.service";
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { EntityManager, In } from 'typeorm';


import { PermissionMetadataRepository } from 'src/repository/permission-metadata.repository';
import { PermissionMetadata } from '../entities/permission-metadata.entity';

@Injectable()
export class PermissionMetadataService extends CRUDService<PermissionMetadata> {
  constructor(
    @Inject(forwardRef(() => ModelMetadataService))
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


