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
var RefreshModelCommand_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshModelCommand = void 0;
const common_1 = require("@nestjs/common");
const nest_commander_1 = require("nest-commander");
const model_metadata_service_1 = require("../services/model-metadata.service");
const helper_1 = require("./helper");
let RefreshModelCommand = RefreshModelCommand_1 = class RefreshModelCommand extends nest_commander_1.CommandRunner {
    constructor(modelMetadataService) {
        super();
        this.modelMetadataService = modelMetadataService;
        this.logger = new common_1.Logger(RefreshModelCommand_1.name);
    }
    async run(_passedParam, options) {
        const errors = this.validate(options);
        if (errors.length) {
            errors.forEach((error) => this.logger.error(error));
            return;
        }
        const codeGenerationOptions = {
            modelId: options.modelId,
            modelUserKey: options.modelName,
            dryRun: options.dryRun,
        };
        await this.modelMetadataService.generateCode(codeGenerationOptions);
    }
    parseModelId(val) {
        return +val;
    }
    parseModelName(val) {
        return val;
    }
    parseDryRun(val) {
        this.logger.debug(`Dry run : ${val}`);
        return (val === 'false') ? false : true;
    }
    validate(options) {
        if (!options.modelId && !options.modelName) {
            return [new helper_1.CommandError('Model ID or Model Name is required')];
        }
        return [];
    }
};
exports.RefreshModelCommand = RefreshModelCommand;
__decorate([
    (0, nest_commander_1.Option)({
        flags: '-id, --modelId [model ID]',
        description: 'Model ID from the ss_model_metadata table',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Number)
], RefreshModelCommand.prototype, "parseModelId", null);
__decorate([
    (0, nest_commander_1.Option)({
        flags: '-n, --modelName [model name]',
        description: 'Model Name from the ss_model_metadata table',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", String)
], RefreshModelCommand.prototype, "parseModelName", null);
__decorate([
    (0, nest_commander_1.Option)({
        flags: '-d, --dryRun [dry run]',
        description: 'Dry run the command',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Boolean)
], RefreshModelCommand.prototype, "parseDryRun", null);
exports.RefreshModelCommand = RefreshModelCommand = RefreshModelCommand_1 = __decorate([
    (0, nest_commander_1.Command)({
        name: 'refresh-model',
        description: 'Updates a model and its fields i.e (entity,dto,service,controller files)',
    }),
    __metadata("design:paramtypes", [model_metadata_service_1.ModelMetadataService])
], RefreshModelCommand);
//# sourceMappingURL=refresh-model.command.js.map