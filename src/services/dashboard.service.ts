import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';


import * as fs from 'fs/promises'; // Use the Promise-based version of fs for async/await
import { SelectionDynamicSourceType } from 'src/dtos/create-dashboard-variable.dto';
import { DashboardVariableSelectionDynamicQueryDto } from 'src/dtos/dashboard-variable-selection-dynamic-query.dto';
import { DashboardVariable } from 'src/entities/dashboard-variable.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { DashboardMapper } from 'src/mappers/dashboard-mapper';
import { DashboardRepository } from 'src/repository/dashboard.repository';
import { Dashboard } from '../entities/dashboard.entity';
import { CreateDashboardDto } from 'src/dtos/create-dashboard.dto';


export const SQL_DYNAMIC_PROVIDER_NAME = 'DashboardVariableSQLDynamicProvider';
@Injectable()
export class DashboardService extends CRUDService<Dashboard> {
  private readonly logger = new Logger(this.constructor.name);
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    readonly repo: DashboardRepository, // Assuming you have a DashboardRepository for custom queries
    readonly moduleRef: ModuleRef,
    readonly solidRegistry: SolidRegistry, // Assuming solidRegistry is injected for selection providers
    readonly moduleMetadataHelperService: ModuleMetadataHelperService,
    readonly dashboardMapper: DashboardMapper,
  ) {
    super(entityManager, repo, 'dashboard', 'solid-core', moduleRef);
  }


  async create(createDto: CreateDashboardDto, files: Express.Multer.File[]) {
    createDto.name = createDto.name.trim().replace(/\s+/g, '-').toLowerCase();
    return super.create(createDto, files);
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

  async saveDashboardToConfig(entity: Dashboard) {
    if (!entity) {
      this.logger.debug('No entity found in the DashboardSubscriber saveDashboardToConfig method');
      return;
    }

    // Validate dashboard details
    const dashboard = entity as Dashboard;
    const moduleMetadata = entity.module;
    if (!moduleMetadata) {
      throw new Error(`Module metadata not found for dashboard id ${entity.id}`);
    }

    // Get config file details
    const { filePath, metaData } = await this.getConfigFileDetails(moduleMetadata.name);
    if (!filePath || !metaData) {
      throw new Error(`Configuration details not found for module: ${moduleMetadata.name}`);
    }

    // Write the dashboard to the config file
    await this.writeToConfig(metaData, dashboard, filePath);
  }

  private async getConfigFileDetails(moduleName: string): Promise<{ filePath: string; metaData: any }> {
    const filePath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`Configuration file not found for module: ${moduleName}`);
    }
    const metaData = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(filePath);
    return { filePath, metaData };
  }

  private async writeToConfig(metaData: any, dashboard: Dashboard, filePath: string) {
    if (metaData.dashboards && Array.isArray(metaData.dashboards)) {
      const dashboardIndex = metaData.dashboards?.findIndex((dashboardFromFile: { name: string; }) => dashboardFromFile.name === dashboard.name);
      const dto = await this.dashboardMapper.toDto(dashboard);
      if (dashboardIndex !== -1) {
        metaData.dashboards[dashboardIndex] = dto;
      }
      else {
        metaData.dashboards.push(dto);
      }
    }
    else {
      const dashboards = [];
      const dto = await this.dashboardMapper.toDto(dashboard);
      dashboards.push(dto);
      metaData.dashboards = dashboards;
    }
    // Write the updated object back to the file
    const updatedContent = JSON.stringify(metaData, null, 2);
    await fs.writeFile(filePath, updatedContent);
  }
}