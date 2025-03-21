import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { EntityManager, Repository } from 'typeorm';
import { CRUDService } from 'src/services/crud.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';
import { ConfigService } from '@nestjs/config';
import { FileService } from "src/services/file.service";
import { CrudHelperService } from "src/services/crud-helper.service";


import { MqMessage } from '../entities/mq-message.entity';

@Injectable()
export class MqMessageService extends CRUDService<MqMessage>{
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
   readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    @InjectRepository(MqMessage)
    readonly repo: Repository<MqMessage>,
     readonly moduleRef: ModuleRef
  ) {
   super(modelMetadataService, moduleMetadataService,  configService, fileService, discoveryService, crudHelperService,entityManager, repo, 'mqMessage', 'queues',moduleRef);
 }
}
