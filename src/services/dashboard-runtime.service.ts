import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import qs from 'qs';
import { ERROR_MESSAGES } from 'src/constants/error-messages';
import { DashboardVariableOptionsQueryDto } from 'src/dtos/dashboard-variable-options-query.dto';
import { DashboardBatchDataRequestDto, DashboardSaveLayoutDto, DashboardWidgetDataRequestDto } from 'src/dtos/dashboard-widget-data-request.dto';
import { ModuleMetadata } from 'src/entities/module-metadata.entity';
import { ModuleMetadataHelperService } from 'src/helpers/module-metadata-helper.service';
import { SolidRegistry } from 'src/helpers/solid-registry';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { IDashboardWidgetDataProviderContext } from 'src/interfaces';
import { DashboardUserLayoutService } from './dashboard-user-layout.service';

@Injectable()
export class DashboardRuntimeService {
    private readonly logger = new Logger(DashboardRuntimeService.name);

    constructor(
        private readonly moduleMetadataHelperService: ModuleMetadataHelperService,
        private readonly solidRegistry: SolidRegistry,
        private readonly dashboardUserLayoutService: DashboardUserLayoutService,
    ) { }

    async getDashboardDefinition(moduleName: string, dashboardName: string): Promise<any> {
        const moduleMetadata = await this.getModuleMetadata(moduleName);
        const dashboards = this.getDashboards(moduleMetadata);
        const dashboard = dashboards.find((d) => d?.name === dashboardName || d?.routeName === dashboardName);

        if (!dashboard) {
            throw new NotFoundException(`Dashboard ${dashboardName} not found for module ${moduleName}.`);
        }

        return dashboard;
    }

    async getWidgetData(
        moduleName: string,
        dashboardName: string,
        widgetName: string,
        request: DashboardWidgetDataRequestDto = {},
        activeUser?: ActiveUserData,
    ): Promise<any> {
        const dashboardDefinition = await this.getDashboardDefinition(moduleName, dashboardName);
        return this.getWidgetDataFromDefinition(dashboardDefinition, moduleName, dashboardName, widgetName, request, activeUser);
    }

    async getDashboardData(
        moduleName: string,
        dashboardName: string,
        request: DashboardBatchDataRequestDto = {},
        activeUser?: ActiveUserData,
    ): Promise<any> {
        const dashboardDefinition = await this.getDashboardDefinition(moduleName, dashboardName);
        const allWidgets = Array.isArray(dashboardDefinition.widgets) ? dashboardDefinition.widgets : [];

        const targetWidgets = request.widgetNames?.length
            ? allWidgets.filter((widget) => request.widgetNames.includes(widget.id) || request.widgetNames.includes(widget.name))
            : allWidgets;

        const widgets = await Promise.all(
            targetWidgets.map((widget) => this.getWidgetDataFromDefinition(
                dashboardDefinition,
                moduleName,
                dashboardName,
                widget.id ?? widget.name,
                request,
                activeUser
            ))
        );

        return {
            moduleName,
            dashboardName: dashboardDefinition.name,
            variables: request.variables ?? {},
            widgets,
        };
    }

    async getVariableOptions(
        moduleName: string,
        dashboardName: string,
        variableName: string,
        query: DashboardVariableOptionsQueryDto,
    ): Promise<any> {
        const dashboardDefinition = await this.getDashboardDefinition(moduleName, dashboardName);
        const variable = (dashboardDefinition.variables ?? []).find((v) => v.name === variableName);

        if (!variable) {
            throw new NotFoundException(`Variable ${variableName} not found in dashboard ${dashboardName}.`);
        }

        if (variable.type === 'selectionStatic') {
            const values = Array.isArray(variable.selectionStaticValues) ? variable.selectionStaticValues : [];
            return values.map((entry: string) => {
                const [value, label] = `${entry}`.split(':');
                return { label: label ?? value, value };
            });
        }

        if (variable.type !== 'selectionDynamic') {
            return [];
        }

        const providerName = variable?.selectionConfig?.providerName;
        if (!providerName) {
            throw new NotFoundException(`Variable ${variableName} does not define a dynamic selection provider.`);
        }

        const selectionProvider = this.solidRegistry.getSelectionProviderInstance(providerName);
        if (!selectionProvider) {
            throw new NotFoundException(ERROR_MESSAGES.PROVIDER_NOT_FOUND(providerName));
        }

        const providerContext = {
            ...(variable?.selectionConfig?.providerContext ?? {}),
            limit: query?.limit ?? 10,
            offset: query?.offset ?? 0,
            formValues: this.parseFormValues(query?.formValues),
        };

        if (query.optionValue) {
            return selectionProvider.value(query.optionValue, providerContext as any);
        }

        return selectionProvider.values(query?.query ?? '', providerContext as any);
    }

    async getLayout(moduleName: string, dashboardName: string, activeUser?: ActiveUserData): Promise<any> {
        const dashboardDefinition = await this.getDashboardDefinition(moduleName, dashboardName);
        const defaultLayout = dashboardDefinition.defaultLayout ?? {};
        const userId = activeUser?.sub ?? null;
        let userLayoutRecord = null;
        try {
            userLayoutRecord = userId
                ? await this.dashboardUserLayoutService.repo.findOne({
                    where: {
                        user: { id: userId },
                        module: { name: moduleName },
                        dashboardName: dashboardDefinition.name,
                    } as any,
                })
                : null;
        } catch (err: any) {
            const isEntityMetadataMissing = `${err?.message ?? ''}`.includes('No metadata for "DashboardUserLayout" was found');
            if (!isEntityMetadataMissing) throw err;
            this.logger.warn('DashboardUserLayout entity metadata is not registered yet. Returning default layout fallback.');
        }
        const userLayout = this.parseLayoutJson(userLayoutRecord?.layoutJson);
        const effectiveLayout = this.mergeLayouts(defaultLayout, userLayout);

        return {
            moduleName,
            dashboardName: dashboardDefinition.name,
            userId,
            defaultLayout,
            userLayout,
            effectiveLayout,
            persisted: !!userLayoutRecord,
        };
    }

    async saveLayout(
        moduleName: string,
        dashboardName: string,
        dto: DashboardSaveLayoutDto,
        activeUser?: ActiveUserData,
    ): Promise<any> {
        const dashboardDefinition = await this.getDashboardDefinition(moduleName, dashboardName);
        const resolvedDashboardName = dashboardDefinition?.name ?? dashboardName;
        const resolvedLayoutJson = this.resolveLayoutPayload(dto);
        const userId = activeUser?.sub;
        if (!userId) {
            return {
                moduleName,
                dashboardName: resolvedDashboardName,
                userId: null,
                persisted: false,
                message: 'Unable to persist layout without active user context.',
                layoutJson: resolvedLayoutJson,
            };
        }
        const layoutJsonAsString = typeof resolvedLayoutJson === 'string'
            ? resolvedLayoutJson
            : JSON.stringify(resolvedLayoutJson ?? {});
        let savedLayout: any = null;
        try {
            const layoutRepo = this.dashboardUserLayoutService.repo;
            const existing = await layoutRepo.findOne({
                where: {
                    user: { id: userId },
                    module: { name: moduleName },
                    dashboardName: resolvedDashboardName,
                } as any,
            });

            const moduleRepo = this.dashboardUserLayoutService.entityManager.getRepository(ModuleMetadata);
            const moduleEntity = await moduleRepo.findOne({ where: { name: moduleName } as any });

            if (!moduleEntity) {
                throw new NotFoundException(`Module ${moduleName} not found.`);
            }

            const toSave = layoutRepo.create({
                ...(existing ? { id: existing.id } : {}),
                user: { id: userId } as any,
                module: { id: moduleEntity.id } as any,
                dashboardName: resolvedDashboardName,
                layoutJson: layoutJsonAsString,
                version: (existing?.version ?? 0) + 1,
            } as any);

            savedLayout = await layoutRepo.save(toSave);
        } catch (err: any) {
            const isEntityMetadataMissing = `${err?.message ?? ''}`.includes('No metadata for "DashboardUserLayout" was found');
            if (!isEntityMetadataMissing) throw err;
            this.logger.warn('DashboardUserLayout entity metadata is not registered yet. Returning non-persistent save fallback.');
            return {
                moduleName,
                dashboardName: resolvedDashboardName,
                userId,
                persisted: false,
                message: 'Layout model generated but entity is not registered in TypeORM yet. Please add DashboardUserLayout to module TypeOrm entities and restart.',
                layoutJson: resolvedLayoutJson,
            };
        }

        return {
            moduleName,
            dashboardName: resolvedDashboardName,
            userId,
            persisted: true,
            message: 'Layout saved successfully.',
            layoutJson: this.parseLayoutJson(savedLayout.layoutJson),
        };
    }

    private async getModuleMetadata(moduleName: string): Promise<any> {
        const configPath = await this.moduleMetadataHelperService.getModuleMetadataFilePath(moduleName);
        const moduleMetadata = await this.moduleMetadataHelperService.getModuleMetadataConfiguration(configPath);

        if (!moduleMetadata) {
            throw new NotFoundException(ERROR_MESSAGES.MODULE_NOT_FOUND(moduleName));
        }

        return moduleMetadata;
    }

    private getDashboards(moduleMetadata: any): any[] {
        return Array.isArray(moduleMetadata?.dashboards) ? moduleMetadata.dashboards : [];
    }

    private findWidgetDefinition(dashboardDefinition: any, widgetName: string): any {
        const widgets = Array.isArray(dashboardDefinition.widgets) ? dashboardDefinition.widgets : [];
        const widgetDefinition = widgets.find((widget) => widget?.id === widgetName || widget?.name === widgetName);

        if (!widgetDefinition) {
            throw new NotFoundException(`Widget ${widgetName} not found in dashboard ${dashboardDefinition?.name ?? ''}.`);
        }

        return widgetDefinition;
    }

    private async getWidgetDataFromDefinition(
        dashboardDefinition: any,
        moduleName: string,
        dashboardName: string,
        widgetName: string,
        request: DashboardWidgetDataRequestDto = {},
        activeUser?: ActiveUserData,
    ): Promise<any> {
        const widgetDefinition = this.findWidgetDefinition(dashboardDefinition, widgetName);
        const providerName = widgetDefinition.dataProvider;

        if (!providerName) {
            throw new NotFoundException(`Widget ${widgetName} is missing dataProvider definition.`);
        }

        const provider = this.solidRegistry.getDashboardWidgetDataProviderInstance(providerName);
        if (!provider) {
            throw new NotFoundException(ERROR_MESSAGES.PROVIDER_NOT_FOUND(providerName));
        }

        const providerContext = {
            ...(widgetDefinition.providerContext ?? {}),
            ...(request.providerContext ?? {}),
        };

        const runtimeContext: IDashboardWidgetDataProviderContext = {
            moduleName,
            dashboardName,
            widgetName: widgetDefinition.id ?? widgetDefinition.name ?? widgetName,
            variables: request.variables ?? {},
            providerContext,
            activeUser,
        };

        const startTime = Date.now();
        const providerResponse = await provider.getData(widgetDefinition, runtimeContext);
        const durationMs = Date.now() - startTime;

        if (providerResponse && typeof providerResponse === 'object' && providerResponse.data !== undefined) {
            const nextMeta = {
                ...(providerResponse.meta ?? {}),
                providerName,
                widgetName: runtimeContext.widgetName,
                durationMs: providerResponse?.meta?.durationMs ?? durationMs,
                generatedAt: providerResponse?.meta?.generatedAt ?? new Date().toISOString(),
            };

            return {
                ...providerResponse,
                meta: nextMeta,
            };
        }

        this.logger.debug(`Widget provider ${providerName} returned a non-envelope payload for ${runtimeContext.widgetName}. Normalizing response.`);
        return {
            meta: {
                providerName,
                widgetName: runtimeContext.widgetName,
                durationMs,
                generatedAt: new Date().toISOString(),
            },
            data: providerResponse,
        };
    }

    private parseFormValues(formValues?: Record<string, any> | string): Record<string, any> {
        if (!formValues) {
            return {};
        }
        if (typeof formValues === 'object') {
            return formValues;
        }

        try {
            const parsedFromQueryString = qs.parse(formValues);
            if (parsedFromQueryString && typeof parsedFromQueryString === 'object') {
                if (parsedFromQueryString['formValues'] && typeof parsedFromQueryString['formValues'] === 'object') {
                    return parsedFromQueryString['formValues'] as Record<string, any>;
                }
                return parsedFromQueryString as Record<string, any>;
            }
        } catch (err) {
            // ignore parse errors and try JSON
        }

        try {
            return JSON.parse(formValues);
        } catch (err) {
            return {};
        }
    }

    private parseLayoutJson(layoutJson: any): any {
        if (layoutJson === null || layoutJson === undefined) return null;
        if (typeof layoutJson !== 'string') return layoutJson;
        try {
            return JSON.parse(layoutJson);
        } catch {
            return layoutJson;
        }
    }

    private resolveLayoutPayload(dto: DashboardSaveLayoutDto | Record<string, any> | null | undefined): any {
        if (!dto) return {};
        if (dto.layoutJson !== undefined) return dto.layoutJson;
        if ((dto as any).layout !== undefined) return (dto as any).layout;
        return dto;
    }

    private mergeLayouts(defaultLayout: any, userLayout: any): any {
        if (!defaultLayout && !userLayout) return {};
        if (!defaultLayout) return userLayout ?? {};
        if (!userLayout) return defaultLayout ?? {};

        const defaultItems = Array.isArray(defaultLayout?.items) ? defaultLayout.items : [];
        const userItems = Array.isArray(userLayout?.items) ? userLayout.items : [];

        if (!defaultItems.length) {
            return {
                ...defaultLayout,
                ...userLayout,
                items: userItems,
            };
        }

        const userByWidget = new Map<string, any>();
        userItems.forEach((item: any) => {
            const key = item?.widgetId ?? item?.id;
            if (key) userByWidget.set(key, item);
        });

        const mergedDefaultItems = defaultItems.map((baseItem: any) => {
            const key = baseItem?.widgetId ?? baseItem?.id;
            if (!key) return baseItem;
            const override = userByWidget.get(key);
            return override ? { ...baseItem, ...override, widgetId: key } : baseItem;
        });

        const defaultKeys = new Set(
            defaultItems
                .map((item: any) => item?.widgetId ?? item?.id)
                .filter((value: any) => !!value)
        );

        const userOnlyItems = userItems.filter((item: any) => {
            const key = item?.widgetId ?? item?.id;
            return !!key && !defaultKeys.has(key);
        });

        return {
            ...defaultLayout,
            ...userLayout,
            columns: userLayout?.columns ?? defaultLayout?.columns ?? 12,
            items: [...mergedDefaultItems, ...userOnlyItems],
        };
    }
}
