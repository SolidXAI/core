import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from "@nestjs/core";
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { CRUDService } from 'src/services/crud.service';
import { DashboardLayout } from 'src/entities/dashboard-layout.entity';
import { DashboardLayoutRepository } from 'src/repository/dashboard-layout.repository';
import { CreateDashboardLayoutDto } from 'src/dtos/create-dashboard-layout.dto';
import { RequestContextService } from './request-context.service';


@Injectable()
export class DashboardLayoutService extends CRUDService<DashboardLayout> {
  private readonly logger = new Logger(this.constructor.name);
  constructor(
    @InjectEntityManager()
    readonly entityManager: EntityManager,
    readonly repo: DashboardLayoutRepository,
    readonly requestContextService: RequestContextService,
    readonly moduleRef: ModuleRef,
  ) {
    super(entityManager, repo, 'dashboardLayout', 'solid-core', moduleRef);
  }

  async upsertUserDashboardLayout(createDtos: CreateDashboardLayoutDto) {
    const activeUser = this.requestContextService.getActiveUser();

    if (!activeUser) {
      throw new Error('User not found');
    }

    let userId = null;
    if (activeUser.roles.includes('Admin')) {
      userId = null;
    } else {
      userId = activeUser?.sub;
    }
    const existingLayout = await this.repo.findOne({
      where: {
        user: { id: userId },
        dashboard: {
          id: createDtos.dashboardId
        }
      },
      relations: {
        user: true,
        dashboard: true,
      }
    });

    if (existingLayout) {
      return super.update(existingLayout.id, { layout: createDtos.layout }, [], true);
    } else {
      const createDto = {
        layout: createDtos.layout,
        dashboardId: createDtos.dashboardId,
        uesrId: userId
      }
      return super.create(createDto, []);
    }
  }

  async getUserDashboardLayoutByDashboardId(dashboardId: any) {
    const activeUser = this.requestContextService.getActiveUser();

    if (!activeUser) {
      throw new Error('User not found');
    }
    const userId = activeUser?.sub;
    const existingUserLayout = await this.repo.findOne({
      where: {
        user: { id: userId },
        dashboard: {
          id: dashboardId
        }
      },
      relations: {
        user: true,
        dashboard: true,
      }
    });
    if (existingUserLayout) {
      // if dahsboard for userid exists 
      return existingUserLayout;
    }

    // if not then check for default dashboard
    const defaultLayout = await this.repo.findOne({
      where: {
        user: { id: null },
        dashboard: {
          id: dashboardId
        }
      },
      relations: {
        user: true,
        dashboard: true,
      }
    });
    if (defaultLayout) {
      // if default layout exists return it
      return defaultLayout;
    } else {
      // if default layout does not exist return empty layout 
      return {
        layout: null
      }
    }
  }
}
