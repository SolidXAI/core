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
var SeedCommand_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeedCommand = void 0;
const common_1 = require("@nestjs/common");
const nest_commander_1 = require("nest-commander");
const solid_registry_1 = require("../helpers/solid-registry");
let SeedCommand = SeedCommand_1 = class SeedCommand extends nest_commander_1.CommandRunner {
    constructor(solidRegistry) {
        super();
        this.solidRegistry = solidRegistry;
        this.logger = new common_1.Logger(SeedCommand_1.name);
    }
    async run(passedParam, options) {
        const seeder = this.solidRegistry
            .getSeeders()
            .filter((seeder) => seeder.name === options.seeder)
            .map((seeder) => seeder.instance)
            .pop();
        if (!seeder) {
            this.logger.error(`Seeder service ${options.seeder} not found. Does your service have a seed() method?`);
            return;
        }
        this.logger.log(`Running the seed() method for seeder :${seeder.constructor.name}`);
        await seeder.seed();
    }
    parseString(val) {
        return val;
    }
};
exports.SeedCommand = SeedCommand;
__decorate([
    (0, nest_commander_1.Option)({
        flags: '-s, --seeder [seeder name]',
        description: 'The seeder to run.',
        required: true
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", String)
], SeedCommand.prototype, "parseString", null);
exports.SeedCommand = SeedCommand = SeedCommand_1 = __decorate([
    (0, nest_commander_1.Command)({ name: 'seed', description: 'Install seed data for a given module' }),
    __metadata("design:paramtypes", [solid_registry_1.SolidRegistry])
], SeedCommand);
//# sourceMappingURL=seed.command.js.map