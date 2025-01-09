"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var CommandService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandService = void 0;
const common_1 = require("@nestjs/common");
const child_process_1 = require("child_process");
let CommandService = CommandService_1 = class CommandService {
    constructor() {
        this.logger = new common_1.Logger(CommandService_1.name);
    }
    async executeCommand(command) {
        this.logger.debug(`Executing command :${command}`);
        return new Promise((resolve, reject) => {
            (0, child_process_1.exec)(command, (error, stdout, stderr) => {
                if (error) {
                    this.logger.error(`Error executing command :${command}`, error);
                    reject(error);
                    return;
                }
                if (stderr) {
                    this.logger.error(`Error executing command :${command}`, stderr);
                    reject(stderr);
                    return;
                }
                resolve(stdout);
            });
        });
    }
};
exports.CommandService = CommandService;
exports.CommandService = CommandService = CommandService_1 = __decorate([
    (0, common_1.Injectable)()
], CommandService);
//# sourceMappingURL=command.service.js.map