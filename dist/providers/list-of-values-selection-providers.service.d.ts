import { ListOfValuesService } from "../services/list-of-values.service";
import { ISelectionProvider, ISelectionProviderContext, ISelectionProviderValues } from "../interfaces";
interface ListOfValuesProviderContext extends ISelectionProviderContext {
    type: string;
}
export declare class ListOfValuesSelectionProvider implements ISelectionProvider<ListOfValuesProviderContext> {
    private readonly listOfValuesService;
    constructor(listOfValuesService: ListOfValuesService);
    name(): string;
    help(): string;
    value(optionValue: string, ctxt: ListOfValuesProviderContext): Promise<ISelectionProviderValues | any>;
    values(query: string, ctxt: ListOfValuesProviderContext): Promise<readonly ISelectionProviderValues[]>;
}
export {};
