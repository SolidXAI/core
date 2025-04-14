import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { EntityManager, Repository } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { ConfigService } from '@nestjs/config';
import { FileService } from 'src/services/file.service';
import { CrudHelperService } from 'src/services/crud-helper.service';


import { ListOfValues } from '../entities/list-of-values.entity';

@Injectable()
export class ListOfValuesService extends CRUDService<ListOfValues> {
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectRepository(ListOfValues, 'default')
    readonly repo: Repository<ListOfValues>,
    readonly moduleRef: ModuleRef

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'listOfValues', 'solid-core', moduleRef);
  }
  async findOneByValueAndType(lovValue: string, lovType: string) {
    return await this.repo.findOne({
      where: {
        value: lovValue,
        type: lovType,
      },
    });
  }
  async upsert(updateListOfValuesDto: any) {
    // First check if module already exists using name
    const existingListOfValue = await this.repo.findOne({
      where: {
        value: updateListOfValuesDto.value
      }
    })

    // if found
    if (existingListOfValue) {
      const updatedListOfValuesDto = { ...existingListOfValue, ...updateListOfValuesDto };
      return this.repo.save(updatedListOfValuesDto);
    }
    // if not found - create new 
    else {
      const listOfValue = this.repo.create(updateListOfValuesDto);
      return this.repo.save(listOfValue);
    }
  }

}
