import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { DatasourceIntrospectionMappingDto, DatasourceIntrospectionRunMigrationDto } from "../dtos/datasource-introspection-mapping.dto";
import { DatasourceIntrospectionService } from "../services/datasource-introspection.service";

@Controller("datasource-introspection")
@ApiTags("Solid Core")
export class DatasourceIntrospectionController {
    constructor(
        private readonly datasourceIntrospectionService: DatasourceIntrospectionService,
    ) { }

    @ApiBearerAuth("jwt")
    @Get("modules/:moduleId/bootstrap")
    getBootstrap(
        @Param("moduleId", ParseIntPipe) moduleId: number,
    ) {
        return this.datasourceIntrospectionService.getBootstrap(moduleId);
    }

    @ApiBearerAuth("jwt")
    @Get("modules/:moduleId/tables")
    getTables(
        @Param("moduleId", ParseIntPipe) moduleId: number,
        @Query("datasource") datasourceName: string,
    ) {
        return this.datasourceIntrospectionService.getTables(moduleId, datasourceName);
    }

    @ApiBearerAuth("jwt")
    @Get("modules/:moduleId/table-detail")
    getTableDetail(
        @Param("moduleId", ParseIntPipe) moduleId: number,
        @Query("datasource") datasourceName: string,
        @Query("table") tableName: string,
        @Query("schema") schema?: string,
    ) {
        return this.datasourceIntrospectionService.getTableDetail(moduleId, datasourceName, tableName, schema);
    }

    @ApiBearerAuth("jwt")
    @Post("modules/:moduleId/mapping-preview")
    previewMapping(
        @Param("moduleId", ParseIntPipe) moduleId: number,
        @Body() mappingDto: DatasourceIntrospectionMappingDto,
    ) {
        return this.datasourceIntrospectionService.previewMapping(moduleId, mappingDto);
    }

    @ApiBearerAuth("jwt")
    @Post("modules/:moduleId/apply-mapping")
    applyMapping(
        @Param("moduleId", ParseIntPipe) moduleId: number,
        @Body() mappingDto: DatasourceIntrospectionMappingDto,
    ) {
        return this.datasourceIntrospectionService.applyMapping(moduleId, mappingDto);
    }

    @ApiBearerAuth("jwt")
    @Post("modules/:moduleId/create-migration-artifacts")
    createMigrationArtifacts(
        @Param("moduleId", ParseIntPipe) moduleId: number,
        @Body() mappingDto: DatasourceIntrospectionMappingDto,
    ) {
        return this.datasourceIntrospectionService.createMigrationArtifacts(moduleId, mappingDto);
    }

    @ApiBearerAuth("jwt")
    @Post("modules/:moduleId/generate-code")
    generateCode(
        @Param("moduleId", ParseIntPipe) moduleId: number,
    ) {
        return this.datasourceIntrospectionService.generateCode(moduleId);
    }

    @ApiBearerAuth("jwt")
    @Post("modules/:moduleId/run-migration")
    runMigration(
        @Param("moduleId", ParseIntPipe) moduleId: number,
        @Body() payload: DatasourceIntrospectionRunMigrationDto,
    ) {
        return this.datasourceIntrospectionService.runMigration(moduleId, payload.datasource);
    }
}
