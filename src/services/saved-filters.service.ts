import { Injectable } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';


import { SavedFiltersRepository } from 'src/repository/saved-filters.repository';
import { SavedFilters } from '../entities/saved-filters.entity';

@Injectable()
export class SavedFiltersService extends CRUDService<SavedFilters>{
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(SavedFilters, 'default')
    // readonly repo: Repository<SavedFilters>,
    readonly repo: SavedFiltersRepository,
    readonly moduleRef: ModuleRef

 ) {
   super(entityManager, repo, 'savedFilters', 'solid-core', moduleRef);
 }
}
