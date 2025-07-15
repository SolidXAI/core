import { Injectable, NotFoundException } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from "@nestjs/core";
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { CrudHelperService } from 'src/services/crud-helper.service';
import { CRUDService } from 'src/services/crud.service';
import { FileService } from 'src/services/file.service';
import { ModelMetadataService } from 'src/services/model-metadata.service';
import { ModuleMetadataService } from 'src/services/module-metadata.service';


import { SelectionDynamicSourceType } from 'src/dtos/create-dashboard-variable.dto';
import { DashboardVariableSelectionDynamicQueryDto } from 'src/dtos/dashboard-variable-selection-dynamic-query.dto';
import { DashboardVariable } from 'src/entities/dashboard-variable.entity';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { Dashboard } from '../entities/dashboard.entity';
import { DashboardRepository } from 'src/repository/dashboard.repository';

export const SQL_DYNAMIC_PROVIDER_NAME = 'DashboardVariableSQLDynamicProvider';
@Injectable()
export class DashboardService extends CRUDService<Dashboard> {
  constructor(
    readonly modelMetadataService: ModelMetadataService,
    readonly moduleMetadataService: ModuleMetadataService,
    readonly configService: ConfigService,
    readonly fileService: FileService,
    readonly discoveryService: DiscoveryService,
    readonly crudHelperService: CrudHelperService,
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    readonly repo: DashboardRepository, // Assuming you have a DashboardRepository for custom queries
    readonly moduleRef: ModuleRef,
    readonly solidRegistry: SolidRegistry, // Assuming solidRegistry is injected for selection providers

  ) {
    super(modelMetadataService, moduleMetadataService, configService, fileService, discoveryService, crudHelperService, entityManager, repo, 'dashboard', 'solid-core', moduleRef);
  }

  async getSelectionDynamicValues(query: DashboardVariableSelectionDynamicQueryDto) {
    // Get the dashboard variable repo
    const dashboardVariable = await this.loadDashboardVariable(query.variableId);

    // Get the providerName and context for the dashboard variable
    const [providerName, context] = this.getProviderNameAndContext(dashboardVariable, query);

    // Get hold of the provider instance from the SolidRegistry
    const selectionProviderInstance = this.solidRegistry.getDashboardVariableSelectionProviderInstance(providerName);
    if (!selectionProviderInstance) {
      throw new NotFoundException(`Field incorrectly configured. No provider with name ${providerName} registered in backend.`);
    }

    // 4. Call the provider's getSelectionDynamicValues method
    return selectionProviderInstance.values(query.query, context);
  }


  private getProviderNameAndContext(dashboardVariable: DashboardVariable, query: DashboardVariableSelectionDynamicQueryDto): [string, any] {
    const sourceType = dashboardVariable.selectionDynamicSourceType;

    // Get the appropriate provide name based on the source type
    let providerName: string;
    const context = { limit: query.limit, offset: query.offset };
    switch (sourceType) {
      case SelectionDynamicSourceType.SQL:
        providerName = SQL_DYNAMIC_PROVIDER_NAME;
        context['sql'] = dashboardVariable.selectionDynamicSQL;
        break;
      case SelectionDynamicSourceType.PROVIDER:
        providerName = dashboardVariable.selectionDynamicProviderName;
        break;
      default:
        throw new Error(`Unsupported selection dynamic source type: ${sourceType}`);
    }
    return [providerName, context];
  }

  private async loadDashboardVariable(variableId: number) {
    const dashboardVariableRepo = this.entityManager.getRepository(DashboardVariable);

    // Load the dashboard record using the field
    const dashboardVariable = await dashboardVariableRepo.findOne({
      where: {
        id: variableId,
      },
    });
    return dashboardVariable;
  }
}
