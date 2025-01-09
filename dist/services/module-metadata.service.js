"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ModuleMetadataService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleMetadataService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const module_metadata_entity_1 = require("../entities/module-metadata.entity");
const strings_1 = require("@angular-devkit/core/src/utils/strings");
const config_1 = require("@nestjs/config");
const fs = require("fs/promises");
const path = require("path");
const permission_metadata_seeder_service_1 = require("../seeders/permission-metadata-seeder.service");
const file_service_1 = require("./file.service");
const schematic_service_1 = require("../helpers/schematic.service");
const solid_registry_1 = require("../helpers/solid-registry");
const crud_helper_service_1 = require("./crud-helper.service");
const model_metadata_service_1 = require("./model-metadata.service");
let ModuleMetadataService = ModuleMetadataService_1 = class ModuleMetadataService {
    constructor(dataSource, moduleMetadataRepo, crudHelperService, schematicService, configService, fileService, permissionsSeederService, modelMetadataService, solidRegistry) {
        this.dataSource = dataSource;
        this.moduleMetadataRepo = moduleMetadataRepo;
        this.crudHelperService = crudHelperService;
        this.schematicService = schematicService;
        this.configService = configService;
        this.fileService = fileService;
        this.permissionsSeederService = permissionsSeederService;
        this.modelMetadataService = modelMetadataService;
        this.solidRegistry = solidRegistry;
        this.logger = new common_1.Logger(ModuleMetadataService_1.name);
    }
    async findMany(basicFilterDto) {
        const alias = 'moduleMetadata';
        let { limit, offset } = basicFilterDto;
        var qb = this.moduleMetadataRepo.createQueryBuilder(alias);
        qb = await this.crudHelperService.buildFilterQuery(qb, basicFilterDto, alias);
        const [entities, count] = await qb.getManyAndCount();
        const currentPage = Math.floor(offset / limit) + 1;
        const totalPages = Math.ceil(count / limit);
        const nextPage = currentPage < totalPages ? currentPage + 1 : null;
        const prevPage = currentPage > 1 ? currentPage - 1 : null;
        const r = {
            meta: {
                totalRecords: count,
                currentPage: currentPage,
                nextPage: nextPage,
                prevPage: prevPage,
                totalPages: totalPages,
                perPage: +limit,
            },
            records: entities
        };
        return r;
    }
    async findOneByUserKey(name, relations = {}) {
        if (!name) {
            throw new common_1.BadRequestException('name is required for finding entity');
        }
        const entity = await this.moduleMetadataRepo.findOne({
            where: {
                name: name,
            },
            relations: relations,
        });
        return entity;
    }
    async findOne(id, relations = {}) {
        if (!id) {
            throw new common_1.BadRequestException('ID is required for finding entity');
        }
        const entity = await this.moduleMetadataRepo.findOne({
            where: {
                id: id,
            },
            relations: relations,
        });
        if (!entity) {
            throw new common_1.NotFoundException(`entity #${id} not found`);
        }
        return entity;
    }
    async create(createDto, files = []) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const module = await this.createInDB(manager, createDto, files);
                await this.createInFile(module);
                return module;
            });
        }
        catch (error) {
            console.error('Transaction failed:', error);
            throw error;
        }
    }
    async createInDB(manager, createDto, files = []) {
        if (files.length > 0) {
            const fileStoragePath = this.getFileSysytemFullFilePath(this.getFileName(files[0]));
            this.fileService.copyFile(files[0].path, fileStoragePath);
            this.fileService.deleteFile(files[0].path);
            createDto.menuIconUrl = fileStoragePath;
        }
        const moduleMetadata = this.moduleMetadataRepo.create(createDto);
        return manager.save(moduleMetadata);
    }
    async createInFile(module) {
        try {
            const moduleMetaDataJson = {
                moduleMetadata: {
                    name: module?.name,
                    displayName: module?.displayName,
                    description: module?.description,
                    defaultDataSource: module?.defaultDataSource,
                    menuIconUrl: module?.menuIconUrl,
                    menuSequenceNumber: module?.menuSequenceNumber,
                    isSystem: module?.isSystem,
                    models: [],
                },
                roles: [],
                users: [],
                actions: [],
                menus: [],
                views: [],
                emailTemplates: [],
                smsTemplates: [],
                mediaStorageProviders: [],
            };
            const metadataJson = JSON.stringify(moduleMetaDataJson, null, 2);
            const folderPath = path.resolve(process.cwd(), 'module-metadata', module.name);
            const filePath = this.getModuleMetadataFilePath(module);
            await fs.mkdir(folderPath, { recursive: true });
            await fs.writeFile(filePath, metadataJson);
        }
        catch (error) {
            console.error('File creation failed:', error);
            throw new Error('File creation failed, rolling back transaction');
        }
    }
    async update(id, updateModuleMetadataDto, files = []) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const module = await this.updateInDB(manager, id, updateModuleMetadataDto, files);
                await this.updateInFile(module);
                return module;
            });
        }
        catch (error) {
            console.error('Transaction failed:', error);
            throw error;
        }
    }
    async updateInDB(manager, id, updateModuleMetadataDto, files = []) {
        const module = await this.moduleMetadataRepo.preload({
            id,
            ...updateModuleMetadataDto,
        });
        if (!module) {
            throw new common_1.NotFoundException(`Module ${id} not found`);
        }
        if (files.length > 0) {
            const fileStoragePath = this.getFileSysytemFullFilePath(this.getFileName(files[0]));
            this.fileService.copyFile(files[0].path, fileStoragePath);
            this.fileService.deleteFile(files[0].path);
            module.menuIconUrl = fileStoragePath;
        }
        return manager.save(module_metadata_entity_1.ModuleMetadata, module);
    }
    async updateInFile(module) {
        try {
            const filePath = this.getModuleMetadataFilePath(module);
            let metaData;
            try {
                metaData = await this.getModuleMetadata(filePath);
            }
            catch (error) {
                metaData = {
                    moduleMetadata: {
                        name: null,
                        displayName: null,
                        description: null,
                        defaultDataSource: null,
                        menuIconUrl: null,
                        menuSequenceNumber: null,
                        isSystem: null,
                        models: [],
                    },
                    roles: [],
                    users: [],
                    actions: [],
                    menus: [],
                    views: [],
                    emailTemplates: [],
                    smsTemplates: [],
                    mediaStorageProviders: [],
                };
            }
            metaData.moduleMetadata.name = module?.name;
            metaData.moduleMetadata.displayName = module?.displayName;
            metaData.moduleMetadata.description = module?.description;
            metaData.moduleMetadata.defaultDataSource = module?.defaultDataSource;
            metaData.moduleMetadata.menuIconUrl = module?.menuIconUrl;
            metaData.moduleMetadata.menuSequenceNumber = module?.menuSequenceNumber;
            metaData.moduleMetadata.isSystem = module?.isSystem;
            const updatedContent = JSON.stringify(metaData, null, 2);
            await fs.writeFile(filePath, updatedContent);
        }
        catch (error) {
            console.error('File creation failed:', error);
            throw new Error('File creation failed, rolling back transaction');
        }
    }
    async getModuleMetadata(filePath) {
        const fileContent = await fs.readFile(filePath, 'utf8');
        return JSON.parse(fileContent);
    }
    getModuleMetadataFilePath(module) {
        const folderPath = path.resolve(process.cwd(), 'module-metadata', module.name);
        const filePath = path.join(folderPath, `${module.name}-metadata.json`);
        return filePath;
    }
    async upsert(updateModuleMetadataDto) {
        this.logger.log(`Module Upsert called for : ${updateModuleMetadataDto.name}`);
        const existingModuleMetadata = await this.moduleMetadataRepo.findOne({
            where: {
                name: updateModuleMetadataDto.name
            }
        });
        const { models, ...restUpdateModuleMetadataDto } = updateModuleMetadataDto;
        if (existingModuleMetadata) {
            const updatedModuleMetadata = { ...existingModuleMetadata, ...restUpdateModuleMetadataDto };
            return this.moduleMetadataRepo.save(updatedModuleMetadata);
        }
        else {
            const moduleMetadata = this.moduleMetadataRepo.create(restUpdateModuleMetadataDto);
            return this.moduleMetadataRepo.save(moduleMetadata);
        }
    }
    async removeByName(name) {
        const entity = await this.findOneByUserKey(name);
        if (entity) {
            await this.moduleMetadataRepo.remove(entity);
        }
    }
    async remove(id) {
        const entity = await this.findOne(id);
        return this.moduleMetadataRepo.remove(entity);
    }
    async deleteMany(ids) {
        if (!ids || ids.length === 0) {
            throw new Error('At least one ID is required for deletion');
        }
        const removedEntities = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const entity = await this.moduleMetadataRepo.findOne({
                where: {
                    id: id,
                }
            });
            removedEntities.push(await this.moduleMetadataRepo.remove(entity));
        }
        return removedEntities;
    }
    async refreshPermission() {
        await this.permissionsSeederService.seed();
        return true;
    }
    async generateCode(options) {
        if (!options.moduleId && !options.moduleUserKey) {
            throw new common_1.BadRequestException('Module ID or Module Name is required for generating code');
        }
        const module = options.moduleId ? await this.findOne(options.moduleId) : await this.findOneByUserKey(options.moduleUserKey);
        if (!module) {
            throw new common_1.NotFoundException(`Module ${options.moduleId} not found`);
        }
        const moduleInstance = this.solidRegistry.getModule(`${(0, strings_1.classify)(module.name)}Module`);
        if (!moduleInstance) {
            return await this.generateAddModuleCode(options);
        }
        else {
            return await this.generateRefreshModuleCode(options);
        }
    }
    async generateAddModuleCode(options = { dryRun: false }) {
        if (!options.moduleId && !options.moduleUserKey) {
            throw new common_1.BadRequestException('Module ID or Module Name is required for generating code');
        }
        const module = options.moduleId ? await this.findOne(options.moduleId) : await this.findOneByUserKey(options.moduleUserKey);
        const output = await this.schematicService.executeSchematicCommand(schematic_service_1.ADD_MODULE_COMMAND, { module: module.name }, options.dryRun ?? false);
        this.logger.debug(`Schematic output : ${output}`);
        return output;
    }
    async generateRefreshModuleCode(options) {
        const query = {
            relations: { models: { fields: true } },
        };
        const module = options.moduleId ? await this.findOne(options.moduleId, query.relations) : await this.findOneByUserKey(options.moduleUserKey, query.relations);
        const outputLines = [];
        for (const model of module.models) {
            const codeGenerationOptions = {
                modelId: model.id,
                dryRun: options.dryRun,
            };
            const output = await this.modelMetadataService.generateCode(codeGenerationOptions);
            this.logger.debug(`Schematic output : ${output}`);
            outputLines.push(output);
        }
        return outputLines.join('\n');
    }
    getFileSysytemFullFilePath(fileName) {
        return `${this.configService.get('app-builder.fileStorageDir')}/${fileName}`;
    }
    getFileName(file) {
        return `${file.filename}-${file.originalname}`;
    }
};
exports.ModuleMetadataService = ModuleMetadataService;
exports.ModuleMetadataService = ModuleMetadataService = ModuleMetadataService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __param(1, (0, typeorm_1.InjectRepository)(module_metadata_entity_1.ModuleMetadata)),
    __param(7, (0, common_1.Inject)((0, common_1.forwardRef)(() => model_metadata_service_1.ModelMetadataService))),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        typeorm_2.Repository,
        crud_helper_service_1.CrudHelperService,
        schematic_service_1.SchematicService,
        config_1.ConfigService,
        file_service_1.FileService,
        permission_metadata_seeder_service_1.PermissionMetadataSeederService,
        model_metadata_service_1.ModelMetadataService,
        solid_registry_1.SolidRegistry])
], ModuleMetadataService);
//# sourceMappingURL=module-metadata.service.js.map