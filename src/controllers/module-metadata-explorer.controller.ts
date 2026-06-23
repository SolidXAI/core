import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MetadataExplorerReferencesQueryDto } from '../dtos/metadata-explorer-references-query.dto';
import { MetadataExplorerSearchQueryDto } from '../dtos/metadata-explorer-search-query.dto';
import { MetadataExplorerWriteDto } from '../dtos/metadata-explorer-write.dto';
import { ModuleMetadataExplorerService } from '../services/module-metadata-explorer.service';

@ApiTags('Solid Core')
@ApiBearerAuth('jwt')
@Controller('module-metadata-explorer')
export class ModuleMetadataExplorerController {
    constructor(
        private readonly moduleMetadataExplorerService: ModuleMetadataExplorerService,
    ) { }

    @Get(':moduleName/manifest')
    async getManifest(@Param('moduleName') moduleName: string) {
        return this.moduleMetadataExplorerService.getManifest(moduleName);
    }

    @Get(':moduleName/document')
    async getDocument(@Param('moduleName') moduleName: string) {
        return this.moduleMetadataExplorerService.getDocument(moduleName);
    }

    @Put(':moduleName/document')
    async updateDocument(
        @Param('moduleName') moduleName: string,
        @Body() body: MetadataExplorerWriteDto,
    ) {
        return this.moduleMetadataExplorerService.updateDocument(moduleName, body);
    }

    @Post(':moduleName/document/validate')
    async validateDocument(
        @Param('moduleName') moduleName: string,
        @Body() body: MetadataExplorerWriteDto,
    ) {
        return this.moduleMetadataExplorerService.validateDocument(moduleName, body);
    }

    @Get(':moduleName/sections/:sectionKey')
    async getSection(
        @Param('moduleName') moduleName: string,
        @Param('sectionKey') sectionKey: string,
    ) {
        return this.moduleMetadataExplorerService.getSection(moduleName, sectionKey);
    }

    @Put(':moduleName/sections/:sectionKey')
    async updateSection(
        @Param('moduleName') moduleName: string,
        @Param('sectionKey') sectionKey: string,
        @Body() body: MetadataExplorerWriteDto,
    ) {
        return this.moduleMetadataExplorerService.updateSection(moduleName, sectionKey, body);
    }

    @Post(':moduleName/sections/:sectionKey/validate')
    async validateSection(
        @Param('moduleName') moduleName: string,
        @Param('sectionKey') sectionKey: string,
        @Body() body: MetadataExplorerWriteDto,
    ) {
        return this.moduleMetadataExplorerService.validateSection(moduleName, sectionKey, body);
    }

    @Get(':moduleName/search')
    async search(
        @Param('moduleName') moduleName: string,
        @Query() query: MetadataExplorerSearchQueryDto,
    ) {
        return this.moduleMetadataExplorerService.search(moduleName, query);
    }

    @Get(':moduleName/references')
    async findReferences(
        @Param('moduleName') moduleName: string,
        @Query() query: MetadataExplorerReferencesQueryDto,
    ) {
        return this.moduleMetadataExplorerService.findReferences(moduleName, query);
    }
}
