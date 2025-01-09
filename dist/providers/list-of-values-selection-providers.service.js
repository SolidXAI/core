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
exports.ListOfValuesSelectionProvider = void 0;
const list_of_values_service_1 = require("../services/list-of-values.service");
const pagination_query_dto_1 = require("../dtos/pagination-query.dto");
const selection_provider_decorator_1 = require("../decorators/selection-provider.decorator");
const common_1 = require("@nestjs/common");
const DEFAULT_LIMIT = 10;
let ListOfValuesSelectionProvider = class ListOfValuesSelectionProvider {
    constructor(listOfValuesService) {
        this.listOfValuesService = listOfValuesService;
    }
    name() {
        return 'ListOfValuesSelectionProvider';
    }
    help() {
        return "# This is lov proivder";
    }
    value(optionValue, ctxt) {
        const lov = this.listOfValuesService.findOneByValueAndType(optionValue, ctxt.type);
        throw new Error("Method not implemented.");
    }
    async values(query, ctxt) {
        const paginatedQuery = new pagination_query_dto_1.PaginationQueryDto(DEFAULT_LIMIT, 0);
        const lovs = await this.listOfValuesService.findAll(paginatedQuery);
        const selectionValues = lovs.map(lov => {
            return {
                label: lov.display,
                value: lov.value
            };
        });
        return selectionValues;
    }
};
exports.ListOfValuesSelectionProvider = ListOfValuesSelectionProvider;
exports.ListOfValuesSelectionProvider = ListOfValuesSelectionProvider = __decorate([
    (0, selection_provider_decorator_1.SelectionProvider)(),
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [list_of_values_service_1.ListOfValuesService])
], ListOfValuesSelectionProvider);
//# sourceMappingURL=list-of-values-selection-providers.service.js.map