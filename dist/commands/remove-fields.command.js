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
var RemoveFieldsCommand_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoveFieldsCommand = void 0;
const common_1 = require("@nestjs/common");
const nest_commander_1 = require("nest-commander");
const model_metadata_service_1 = require("../services/model-metadata.service");
let RemoveFieldsCommand = RemoveFieldsCommand_1 = class RemoveFieldsCommand extends nest_commander_1.CommandRunner {
    constructor(modelMetadataService) {
        super();
        this.modelMetadataService = modelMetadataService;
        this.logger = new common_1.Logger(RemoveFieldsCommand_1.name);
    }
    async run(_passedParam, options) {
        const codeGenerationOptions = {
            modelId: options.modelId,
            fieldIdsForRemoval: options.fieldIds,
            dryRun: options.dryRun,
        };
        await this.modelMetadataService.generateRemoveFieldsCode(codeGenerationOptions);
    }
    parseFieldIds(val) {
        if (!val.startsWith('[') || !val.endsWith(']')) {
            throw new common_1.BadRequestException('Field IDs should be a json array');
        }
        return JSON.parse(val).map((id) => parseInt(id));
    }
    parseModelId(val) {
        return +val;
    }
    parseDryRun(val) {
        this.logger.debug(`Dry run : ${val}`);
        return (val === 'false') ? false : true;
    }
};
exports.RemoveFieldsCommand = RemoveFieldsCommand;
__decorate([
    (0, nest_commander_1.Option)({
        flags: '-fids, --fieldIds [Array of field IDs]',
        description: 'Json array of Field IDs from the ss_field_metadata table',
        required: true,
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Array)
], RemoveFieldsCommand.prototype, "parseFieldIds", null);
__decorate([
    (0, nest_commander_1.Option)({
        flags: '-mid, --modelId [model ID]',
        description: 'Model id from the ss_model_metadata table',
        required: true,
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Number)
], RemoveFieldsCommand.prototype, "parseModelId", null);
__decorate([
    (0, nest_commander_1.Option)({
        flags: '-d, --dryRun [dry run]',
        description: 'Dry run the command',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Boolean)
], RemoveFieldsCommand.prototype, "parseDryRun", null);
exports.RemoveFieldsCommand = RemoveFieldsCommand = RemoveFieldsCommand_1 = __decorate([
    (0, nest_commander_1.Command)({
        name: 'remove-fields',
        description: 'Adds fields to a model',
    }),
    __metadata("design:paramtypes", [model_metadata_service_1.ModelMetadataService])
], RemoveFieldsCommand);
//# sourceMappingURL=remove-fields.command.js.map