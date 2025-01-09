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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicCommand = void 0;
const nest_commander_1 = require("nest-commander");
let BasicCommand = class BasicCommand extends nest_commander_1.CommandRunner {
    constructor() {
        super();
    }
    async run(passedParam, options) {
        console.log(`passed params are: `, passedParam);
        console.log(`options are: `, options);
        if (options?.boolean !== undefined && options?.boolean !== null) {
            this.runWithBoolean(passedParam, options.boolean);
        }
        else if (options?.number) {
            this.runWithNumber(passedParam, options.number);
        }
        else if (options?.string) {
            this.runWithString(passedParam, options.string);
        }
        else {
            this.runWithNone(passedParam);
        }
    }
    parseNumber(val) {
        return Number(val);
    }
    parseString(val) {
        return val;
    }
    parseBoolean(val) {
        return JSON.parse(val);
    }
    runWithString(param, option) {
        console.log({ param, string: option });
    }
    runWithNumber(param, option) {
        console.log({ param, number: option });
    }
    runWithBoolean(param, option) {
        console.log({ param, boolean: option });
    }
    runWithNone(param) {
        console.log({ param });
    }
};
exports.BasicCommand = BasicCommand;
__decorate([
    (0, nest_commander_1.Option)({ flags: '-n, --number [number]', description: 'A basic number parser' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Number)
], BasicCommand.prototype, "parseNumber", null);
__decorate([
    (0, nest_commander_1.Option)({ flags: '-s, --string [string]', description: 'A string return' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", String)
], BasicCommand.prototype, "parseString", null);
__decorate([
    (0, nest_commander_1.Option)({ flags: '-b, --boolean [boolean]', description: 'A boolean parser' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Boolean)
], BasicCommand.prototype, "parseBoolean", null);
exports.BasicCommand = BasicCommand = __decorate([
    (0, nest_commander_1.Command)({ name: 'basic', description: 'A parameter parse' }),
    __metadata("design:paramtypes", [])
], BasicCommand);
//# sourceMappingURL=basic.command.js.map