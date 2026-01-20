import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef } from "@nestjs/core";
import { EntityManager } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';

import { ModelSequence } from '../entities/model-sequence.entity';
import { ModelSequenceRepository } from '../repository/model-sequence.repository';

@Injectable()
export class ModelSequenceService extends CRUDService<ModelSequence>{
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    readonly repo: ModelSequenceRepository,
    readonly moduleRef: ModuleRef

 ) {
   super(entityManager, repo, 'modelSequence', 'solid-core', moduleRef);
 }
}
