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


import { ActionMetadataRepository } from 'src/repository/action-metadata.repository';
import { ActionMetadata } from '../entities/action-metadata.entity';

@Injectable()
export class ActionMetadataService extends CRUDService<ActionMetadata> {
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
    // @InjectRepository(ActionMetadata, 'default')
    // readonly repo: Repository<ActionMetadata>,
    readonly repo: ActionMetadataRepository,
    readonly moduleRef: ModuleRef

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'actionMetadata', 'solid-core', moduleRef);
  }

  async findOneByUserKey(name: string, relations = {}) {
    const entity = await this.repo.findOne({
      where: {
        name: name,
      },
      relations: relations,
    });
    return entity;
  }

  async upsert(updateSolidActionDto: any) {
    // First check if module already exists using name
    const existingSolidAction = await this.repo.findOne({
      where: {
        name: updateSolidActionDto.name
      }
    })

    // if found
    if (existingSolidAction) {
      const updatedSolidActionDto = { ...existingSolidAction, ...updateSolidActionDto };
      return this.repo.save(updatedSolidActionDto);
    }
    // if not found - create new 
    else {
      const moduleMetadata = this.repo.create(updateSolidActionDto);
      return this.repo.save(moduleMetadata);
    }
  }

}
