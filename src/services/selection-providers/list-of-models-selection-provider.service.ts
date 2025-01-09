import { Injectable } from "@nestjs/common";
import { ModelMetadataService } from "src/services/model-metadata.service";
import { SelectionProvider } from "src/decorators/selection-provider.decorator";
import { ISelectionProvider, ISelectionProviderContext, ISelectionProviderValues } from "../../interfaces";


@SelectionProvider()
@Injectable()
export class ListOfModelsSelectionProvider implements ISelectionProvider<ISelectionProviderContext> {
    private readonly modelMetadataService: ModelMetadataService;
    constructor(modelMetadataService: ModelMetadataService) {
        this.modelMetadataService = modelMetadataService;
    }
    help(): string {
        return "# Allows one to dynamically fetch models Across all models";
    }
    name(): string {
        return 'ListOfModelsSelectionProvider';
    }
    async value(optionValue: string, ctxt: ISelectionProviderContext): Promise<ISelectionProviderValues | any> {
        // Create a unified array with unique languages

        const queryData = {
            fields: [],
            filters: [],
            sort: [],
            populate: [],
            populateMedia: [],
            groupBy: [],
            limit: 100,
            offset: 0,
        }
        const models = (await this.modelMetadataService.findMany(queryData)).records;

        const model = models.filter(i => i.singularName === optionValue)[0];
        return { label: model.singularName, value: model.id }
    }

    async values(query: string, ctxt: ISelectionProviderContext): Promise<readonly ISelectionProviderValues[]> {
        // Filter function 

        // TODO: Instead of using limit 1000, we can pass filters here so that we are able to query directly.
        const queryData = {
            fields: [],
            filters: [],
            sort: [],
            populate: [],
            populateMedia: [],
            groupBy: [],
            limit: 1000,
            offset: 0,
        }
        const models = (await this.modelMetadataService.findMany(queryData)).records;
        const getModelsByQuery = (query: string) => {
            const lowerCaseQuery = query.toLowerCase();
            return models.filter(model => model.singularName.toLowerCase().includes(lowerCaseQuery));
        }

        const filteredModels = query ? getModelsByQuery(query) : models;

        // return filteredModels.map(i => {
        //     return { label: i.singularName, value: String(i.id) };
        // });

        return filteredModels.map(i => {
            return { label: i.singularName, value: i.singularName };
        });

    }
}