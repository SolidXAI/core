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
var RefreshModuleCommand_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshModuleCommand = void 0;
const common_1 = require("@nestjs/common");
const nest_commander_1 = require("nest-commander");
const model_metadata_service_1 = require("../services/model-metadata.service");
const module_metadata_service_1 = require("../services/module-metadata.service");
const helper_1 = require("./helper");
let RefreshModuleCommand = RefreshModuleCommand_1 = class RefreshModuleCommand extends nest_commander_1.CommandRunner {
    constructor(moduleMetadataService, modelMetadataService) {
        super();
        this.moduleMetadataService = moduleMetadataService;
        this.modelMetadataService = modelMetadataService;
        this.logger = new common_1.Logger(RefreshModuleCommand_1.name);
    }
    async run(_passedParam, options) {
        const errors = this.validate(options);
        if (errors.length) {
            errors.forEach((error) => this.logger.error(error));
            return;
        }
        const codeGenerationOptions = {
            moduleId: options.moduleId,
            moduleUserKey: options.moduleName,
            dryRun: options.dryRun,
        };
        await this.moduleMetadataService.generateCode(codeGenerationOptions);
    }
    parseModuleId(val) {
        return +val;
    }
    parseModuleName(val) {
        return val;
    }
    parseDryRun(val) {
        this.logger.debug(`Dry run : ${val}`);
        return (val === 'false') ? false : true;
    }
    validate(options) {
        if (!options.moduleId && !options.moduleName) {
            return [new helper_1.CommandError('Module ID or Module Name is required')];
        }
        return [];
    }
};
exports.RefreshModuleCommand = RefreshModuleCommand;
__decorate([
    (0, nest_commander_1.Option)({
        flags: '-id, --moduleId [module ID]',
        description: 'Module ID from the ss_module_metadata table',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Number)
], RefreshModuleCommand.prototype, "parseModuleId", null);
__decorate([
    (0, nest_commander_1.Option)({
        flags: '-n, --moduleName [module name]',
        description: 'Module Name from the ss_module_metadata table',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", String)
], RefreshModuleCommand.prototype, "parseModuleName", null);
__decorate([
    (0, nest_commander_1.Option)({
        flags: '-d, --dryRun [dry run]',
        description: 'Dry run the command',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Boolean)
], RefreshModuleCommand.prototype, "parseDryRun", null);
exports.RefreshModuleCommand = RefreshModuleCommand = RefreshModuleCommand_1 = __decorate([
    (0, nest_commander_1.Command)({
        name: 'refresh-module',
        description: 'Refreshes a module and its model and fields i.e (entity,dto,service,controller files)',
    }),
    __metadata("design:paramtypes", [module_metadata_service_1.ModuleMetadataService,
        model_metadata_service_1.ModelMetadataService])
], RefreshModuleCommand);
//# sourceMappingURL=refresh-module.command.js.map