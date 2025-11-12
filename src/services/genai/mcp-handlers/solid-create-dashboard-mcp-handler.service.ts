import { Injectable } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { CreateDashboardDto } from "src/dtos/create-dashboard.dto";
import { UpdateMenuItemMetadataDto } from "src/dtos/update-menu-item-metadata.dto";
import { AiInteraction } from "src/entities/ai-interaction.entity";
import { Dashboard } from "src/entities/dashboard.entity";
import { IMcpToolResponseHandler } from "../../../interfaces";
import { ActionMetadataService } from "../../action-metadata.service";
import { DashboardService } from "../../dashboard.service";
import { MenuItemMetadataService } from "../../menu-item-metadata.service";
import { ModelMetadataService } from "../../model-metadata.service";
import { ModuleMetadataService } from "../../module-metadata.service";
import { RoleMetadataService } from "../../role-metadata.service";

@Injectable()
export class SolidCreateDashboardWithWidgetsMcpHandler implements IMcpToolResponseHandler {

    constructor(
        private readonly dashboardService: DashboardService,
        private readonly actionMetadataService: ActionMetadataService,
        private readonly menuItemMetadataService: MenuItemMetadataService,
        private readonly moduleMetadataService: ModuleMetadataService,
        private readonly modelMetadataService: ModelMetadataService,
        private readonly roleService: RoleMetadataService, // Assuming roleService is a Mongoose model, adjust as necessary
    ) {
    }

    async apply(aiInteraction: AiInteraction) {
        const escapedMessage = aiInteraction.message.replace(/\\'/g, "'");
        const aiResponseMessage = JSON.parse(escapedMessage);
        const { data } = aiResponseMessage;
        const { schema } = data;
        const { dashboardDto, dashboard } = await this.createDashboard(schema);

        const { moduleUserKey, actionMetadataEntity } = await this.createActionMetadataEntry(dashboardDto, dashboard);

        await this.createMenuItemEntry(dashboard, moduleUserKey, actionMetadataEntity);

        // TODO: decide on some shape to return hre...
        return {
            seedingRequired: false,
            serverRebooting: false,
        }
    }


    private async createMenuItemEntry(dashboard: Dashboard, moduleUserKey: string, actionMetadataEntity: any) {
        const menuData = {
            displayName: dashboard.displayName || dashboard.name,
            name: `${moduleUserKey}-${dashboard.name}-dashboard-menu-item`,
            sequenceNumber: 1,
            actionUserKey: actionMetadataEntity.name,
            moduleUserKey: moduleUserKey,
            parentMenuItemUserKey: '',
        };

        const adminRole = await this.roleService.findRoleByName('Admin');
        const specifiedRoles = menuData['roles'];

        // If the developer has specified roles, then resolve them, making sure that admin role is also given.
        const specifiedRoleObjects = [adminRole];
        if (specifiedRoles) {
            for (let i = 0; i < specifiedRoles.length; i++) {
                const specifiedRole = specifiedRoles[i];
                const specifiedRoleObject = await this.roleService.findRoleByName(specifiedRole);
                if (!specifiedRoleObject) {
                    throw new Error(`Invalid role: (${specifiedRole}) specified against menu with display name ${menuData.displayName}.`);
                }
                specifiedRoleObjects.push(specifiedRoleObject);
            }
        }

        menuData['roles'] = specifiedRoleObjects;
        menuData['action'] = await this.actionMetadataService.findOneByUserKey(menuData.actionUserKey);
        menuData['module'] = await this.moduleMetadataService.findOneByUserKey(menuData.moduleUserKey);

        if (menuData.parentMenuItemUserKey) {
            menuData['parentMenuItem'] = await this.menuItemMetadataService.findOneByUserKey(menuData.parentMenuItemUserKey);
        } else {
            menuData['parentMenuItem'] = null;
        }
        await this.menuItemMetadataService.upsert(menuData as unknown as UpdateMenuItemMetadataDto);
    }

    private async createActionMetadataEntry(dashboardDto: CreateDashboardDto, dashboard: Dashboard) {
        const moduleUserKey = dashboardDto.moduleUserKey;
        const actionMetadata = {
            name: `${dashboard.name}-view`,
            displayName: dashboard.displayName || dashboard.name,
            type: 'custom',
            domain: "{}",
            context: "{}",
            customComponent: `/admin/core/${moduleUserKey}/dashboards?dashboardName=${dashboard.name}`,
            customIsModal: true,
            serverEndpoint: '',
            moduleUserKey: moduleUserKey,
            modelUserKey: '',
            viewUserKey: `${dashboard.name}-view`,
        };
        actionMetadata['module'] = await this.moduleMetadataService.findOneByUserKey(actionMetadata.moduleUserKey);
        if (actionMetadata.modelUserKey) {
            actionMetadata['model'] = await this.modelMetadataService.findOneByUserKey(actionMetadata.modelUserKey);
        }
        const actionMetadataEntity = await this.actionMetadataService.upsert(actionMetadata);
        return { moduleUserKey, actionMetadataEntity };
    }

    private async createDashboard(aiResponseMessage: any) {
        const dashboardDto = plainToInstance(CreateDashboardDto, aiResponseMessage);
        dashboardDto['layoutJson'] = JSON.stringify(dashboardDto['layoutJson']);
        const dashboard = await this.dashboardService.create(dashboardDto, []);
        return { dashboardDto, dashboard };
    }
}