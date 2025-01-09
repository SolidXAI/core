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
exports.ListOfModelsSelectionProvider = void 0;
const common_1 = require("@nestjs/common");
const model_metadata_service_1 = require("../model-metadata.service");
const selection_provider_decorator_1 = require("../../decorators/selection-provider.decorator");
let ListOfModelsSelectionProvider = class ListOfModelsSelectionProvider {
    constructor(modelMetadataService) {
        this.modelMetadataService = modelMetadataService;
    }
    help() {
        return "# Allows one to dynamically fetch models Across all models";
    }
    name() {
        return 'ListOfModelsSelectionProvider';
    }
    async value(optionValue, ctxt) {
        const queryData = {
            fields: [],
            filters: [],
            sort: [],
            populate: [],
            populateMedia: [],
            groupBy: [],
            limit: 100,
            offset: 0,
        };
        const models = (await this.modelMetadataService.findMany(queryData)).records;
        const model = models.filter(i => i.singularName === optionValue)[0];
        return { label: model.singularName, value: model.id };
    }
    async values(query, ctxt) {
        const queryData = {
            fields: [],
            filters: [],
            sort: [],
            populate: [],
            populateMedia: [],
            groupBy: [],
            limit: 1000,
            offset: 0,
        };
        const models = (await this.modelMetadataService.findMany(queryData)).records;
        const getModelsByQuery = (query) => {
            const lowerCaseQuery = query.toLowerCase();
            return models.filter(model => model.singularName.toLowerCase().includes(lowerCaseQuery));
        };
        const filteredModels = query ? getModelsByQuery(query) : models;
        return filteredModels.map(i => {
            return { label: i.singularName, value: i.singularName };
        });
    }
};
exports.ListOfModelsSelectionProvider = ListOfModelsSelectionProvider;
exports.ListOfModelsSelectionProvider = ListOfModelsSelectionProvider = __decorate([
    (0, selection_provider_decorator_1.SelectionProvider)(),
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [model_metadata_service_1.ModelMetadataService])
], ListOfModelsSelectionProvider);
//# sourceMappingURL=list-of-models-selection-provider.service.js.map