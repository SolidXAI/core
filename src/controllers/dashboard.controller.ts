import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActiveUser } from 'src/decorators/active-user.decorator';
import { DashboardVariableOptionsQueryDto } from 'src/dtos/dashboard-variable-options-query.dto';
import { DashboardBatchDataRequestDto, DashboardSaveLayoutDto, DashboardWidgetDataRequestDto } from 'src/dtos/dashboard-widget-data-request.dto';
import { ActiveUserData } from 'src/interfaces/active-user-data.interface';
import { DashboardRuntimeService } from 'src/services/dashboard-runtime.service';

@Controller('dashboard')
@ApiTags('Solid Core')
export class DashboardController {
    constructor(
        private readonly dashboardRuntimeService: DashboardRuntimeService,
    ) { }

    @ApiBearerAuth('jwt')
    @Get(':moduleName/:dashboardName/definition')
    async getDefinition(
        @Param('moduleName') moduleName: string,
        @Param('dashboardName') dashboardName: string,
    ) {
        return this.dashboardRuntimeService.getDashboardDefinition(moduleName, dashboardName);
    }

    @ApiBearerAuth('jwt')
    @Post(':moduleName/:dashboardName/widgets/:widgetName/data')
    async getWidgetData(
        @Param('moduleName') moduleName: string,
        @Param('dashboardName') dashboardName: string,
        @Param('widgetName') widgetName: string,
        @Body() request: DashboardWidgetDataRequestDto,
        @ActiveUser() activeUser: ActiveUserData,
    ) {
        return this.dashboardRuntimeService.getWidgetData(moduleName, dashboardName, widgetName, request, activeUser);
    }

    @ApiBearerAuth('jwt')
    @Post(':moduleName/:dashboardName/data')
    async getDashboardData(
        @Param('moduleName') moduleName: string,
        @Param('dashboardName') dashboardName: string,
        @Body() request: DashboardBatchDataRequestDto,
        @ActiveUser() activeUser: ActiveUserData,
    ) {
        return this.dashboardRuntimeService.getDashboardData(moduleName, dashboardName, request, activeUser);
    }

    @ApiBearerAuth('jwt')
    @Get(':moduleName/:dashboardName/variable-options/:variableName')
    async getVariableOptions(
        @Param('moduleName') moduleName: string,
        @Param('dashboardName') dashboardName: string,
        @Param('variableName') variableName: string,
        @Query() query: DashboardVariableOptionsQueryDto,
    ) {
        return this.dashboardRuntimeService.getVariableOptions(moduleName, dashboardName, variableName, query);
    }

    @ApiBearerAuth('jwt')
    @Get(':moduleName/:dashboardName/layout')
    async getLayout(
        @Param('moduleName') moduleName: string,
        @Param('dashboardName') dashboardName: string,
        @ActiveUser() activeUser: ActiveUserData,
    ) {
        return this.dashboardRuntimeService.getLayout(moduleName, dashboardName, activeUser);
    }

    @ApiBearerAuth('jwt')
    @Put(':moduleName/:dashboardName/layout')
    async saveLayout(
        @Param('moduleName') moduleName: string,
        @Param('dashboardName') dashboardName: string,
        @Body() body: DashboardSaveLayoutDto,
        @ActiveUser() activeUser: ActiveUserData,
    ) {
        return this.dashboardRuntimeService.saveLayout(moduleName, dashboardName, body, activeUser);
    }
}

