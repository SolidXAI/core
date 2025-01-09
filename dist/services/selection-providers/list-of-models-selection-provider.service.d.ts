import { ModelMetadataService } from "src/services/model-metadata.service";
import { ISelectionProvider, ISelectionProviderContext, ISelectionProviderValues } from "../../interfaces";
export declare class ListOfModelsSelectionProvider implements ISelectionProvider<ISelectionProviderContext> {
    private readonly modelMetadataService;
    constructor(modelMetadataService: ModelMetadataService);
    help(): string;
    name(): string;
    value(optionValue: string, ctxt: ISelectionProviderContext): Promise<ISelectionProviderValues | any>;
    values(query: string, ctxt: ISelectionProviderContext): Promise<readonly ISelectionProviderValues[]>;
}
