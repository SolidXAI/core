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
var SchematicService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchematicService = exports.REFRESH_MODEL_COMMAND = exports.REMOVE_FIELDS_COMMAND = exports.ADD_MODULE_COMMAND = void 0;
const common_1 = require("@nestjs/common");
const command_service_1 = require("./command.service");
exports.ADD_MODULE_COMMAND = 'add-module';
exports.REMOVE_FIELDS_COMMAND = 'remove-fields';
exports.REFRESH_MODEL_COMMAND = 'refresh-model';
var SYSTEM_FIELDS_TO_IGNORE_FOR_CODE_GENERATION;
(function (SYSTEM_FIELDS_TO_IGNORE_FOR_CODE_GENERATION) {
    SYSTEM_FIELDS_TO_IGNORE_FOR_CODE_GENERATION["ID"] = "id";
    SYSTEM_FIELDS_TO_IGNORE_FOR_CODE_GENERATION["CREATED_AT"] = "createdAt";
    SYSTEM_FIELDS_TO_IGNORE_FOR_CODE_GENERATION["UPDATED_AT"] = "updatedAt";
    SYSTEM_FIELDS_TO_IGNORE_FOR_CODE_GENERATION["DELETED_AT"] = "deletedAt";
})(SYSTEM_FIELDS_TO_IGNORE_FOR_CODE_GENERATION || (SYSTEM_FIELDS_TO_IGNORE_FOR_CODE_GENERATION = {}));
let SchematicService = SchematicService_1 = class SchematicService {
    constructor(commandService) {
        this.commandService = commandService;
        this.logger = new common_1.Logger(SchematicService_1.name);
        this.SCHEMATIC_PROJECT = 'code-builder';
    }
    async executeSchematicCommand(command, options, debug = false) {
        return await this.commandService.executeCommand(this.generateSchematicCommand(command, options, debug));
    }
    generateSchematicCommand(command, options, debug) {
        const baseCommand = `schematics ./${this.SCHEMATIC_PROJECT}:${command} --debug=${debug}`;
        if (command === exports.REMOVE_FIELDS_COMMAND ||
            command === exports.REFRESH_MODEL_COMMAND) {
            const fieldOptions = options;
            let modelCommand = `${baseCommand} --module=${fieldOptions.module} --model=${fieldOptions.model}`;
            if (fieldOptions.moduleDisplayName) {
                modelCommand += ` --module-display-name=${fieldOptions.moduleDisplayName}`;
            }
            if (fieldOptions.table) {
                modelCommand += ` --table=${fieldOptions.table}`;
            }
            if (fieldOptions.dataSource) {
                modelCommand += ` --data-source=${fieldOptions.dataSource}`;
            }
            let fieldCommand = fieldOptions.fields
                .filter((field) => {
                return !Object.values(SYSTEM_FIELDS_TO_IGNORE_FOR_CODE_GENERATION).includes(field.name);
            })
                .map((field) => {
                return `--fields='${JSON.stringify(field)}'`;
            })
                .join(' ');
            const schematicCommand = modelCommand + ' ' + fieldCommand;
            return schematicCommand;
        }
        else if (command === exports.ADD_MODULE_COMMAND) {
            const moduleOptions = options;
            const schematicCommand = ` ${baseCommand} --module=${moduleOptions.module}`;
            this.logger.log('schematicCommand', schematicCommand);
            return schematicCommand;
        }
        else {
            throw new Error('Schematic command not supported.');
        }
    }
};
exports.SchematicService = SchematicService;
exports.SchematicService = SchematicService = SchematicService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [command_service_1.CommandService])
], SchematicService);
//# sourceMappingURL=schematic.service.js.map