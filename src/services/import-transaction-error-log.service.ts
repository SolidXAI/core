import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ModuleRef } from "@nestjs/core";
import { EntityManager } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';


import { ImportTransactionErrorLog } from '../entities/import-transaction-error-log.entity';
import { ImportTransactionErrorLogRepository } from 'src/repository/import-transaction-error-log.repository';

@Injectable()
export class ImportTransactionErrorLogService extends CRUDService<ImportTransactionErrorLog>{
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(ImportTransactionErrorLog, 'default')
    // readonly repo: Repository<ImportTransactionErrorLog>,
    readonly repo: ImportTransactionErrorLogRepository,
    readonly moduleRef: ModuleRef

 ) {
   super(entityManager, repo, 'importTransactionErrorLog', 'solid-core', moduleRef);
 }
}
