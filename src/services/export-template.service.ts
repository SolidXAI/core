import { ForbiddenException, Injectable } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';


import { CreateExportTransactionDto } from 'src/dtos/create-export-transaction.dto';
import { ExportTransaction } from 'src/entities/export-transaction.entity';
import { ExportTemplate } from '../entities/export-template.entity';
import { ExportTransactionFileInfo, ExportTransactionService } from './export-transaction.service';
import { UpdateExportTemplateDto } from 'src/dtos/update-export-template.dto';
import { ExportTemplateRepository } from 'src/repository/export-template.repository';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import {upperFirst, camelCase} from 'lodash';

@Injectable()
export class ExportTemplateService extends CRUDService<ExportTemplate>{
  async startExportSync(updateDto: UpdateExportTemplateDto, filters:any,  activeUser: ActiveUserData): Promise<ExportTransactionFileInfo> {
    // Create the export transaction entry, with status 'started'
    const modelMetadata = await this.modelMetadataService.findOne(updateDto?.modelMetadataId);
    const modelName = upperFirst(camelCase(modelMetadata.singularName));
    const permissionKey = `${modelName}Controller.findMany`;

    const userPermissions = activeUser.permissions ?? [];
    const hasPermission = Array.isArray(userPermissions)
      ? userPermissions.includes(permissionKey)
      : userPermissions[permissionKey] === true;

    if (!hasPermission) {
      throw new ForbiddenException(
        `Missing permission: ${permissionKey}`
      );
    }
    const exportTransaction: CreateExportTransactionDto =  await this.exportTransactionService.toDto({
      datetime: new Date(),
      status: 'started',
      exportTemplateId: updateDto?.id ? updateDto?.id : null,
    });
    const exportTransactionEntity = await this.exportTransactionService.create(exportTransaction);

    // Trigger the export process
    const exportFileInfo = await this.exportTransactionService.triggerExportSync(exportTransactionEntity.id, exportTransactionEntity, updateDto, filters);
    // It should return the export transaction id
    return exportFileInfo;
  }

  async startExportAsync(updateDto: UpdateExportTemplateDto,  filters:any): Promise<ExportTransaction>{
    // Create the export transaction entry, with status 'started'
    const exportTransaction: CreateExportTransactionDto =  await this.exportTransactionService.toDto({
      datetime: new Date(),
      status: 'started',
      exportTemplateId: updateDto?.id ? updateDto?.id : null,
    });
    const exportTransactionEntity = await this.exportTransactionService.create(exportTransaction);

    // Trigger the export process
    this.exportTransactionService.triggerExportAsync(exportTransactionEntity.id, exportTransactionEntity, updateDto, filters);

    // It should return the export transaction id, so client can use this to check the status
    return exportTransactionEntity;
  }

  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    // @InjectRepository(ExportTemplate, 'default')
    // readonly repo: Repository<ExportTemplate>,
    readonly repo: ExportTemplateRepository,
    readonly exportTransactionService: ExportTransactionService,
    readonly moduleRef: ModuleRef
 ) {
   super(entityManager, repo, 'exportTemplate', 'solid-core',moduleRef);
 }
}
