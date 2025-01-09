
import { ListOfValuesService } from "../services/list-of-values.service";
import { PaginationQueryDto } from "src/dtos/pagination-query.dto";
import { SelectionProvider } from "src/decorators/selection-provider.decorator";
import { Injectable } from "@nestjs/common";
import { ISelectionProvider, ISelectionProviderContext, ISelectionProviderValues } from "../interfaces";

interface ListOfValuesProviderContext extends ISelectionProviderContext {
    type: string;
}

const DEFAULT_LIMIT = 10;

@SelectionProvider()
@Injectable()
export class ListOfValuesSelectionProvider implements ISelectionProvider<ListOfValuesProviderContext> {
    constructor(private readonly listOfValuesService: ListOfValuesService) { }

    name(): string {
        return 'ListOfValuesSelectionProvider';
    }

    help(): string {
        return "# This is lov proivder";
    }

    value(optionValue: string, ctxt: ListOfValuesProviderContext): Promise<ISelectionProviderValues | any> {
        const lov = this.listOfValuesService.findOneByValueAndType(optionValue, ctxt.type)

        throw new Error("Method not implemented.");
    }

    async values(query: string, ctxt: ListOfValuesProviderContext): Promise<readonly ISelectionProviderValues[]> {
        const paginatedQuery = new PaginationQueryDto(DEFAULT_LIMIT, 0);
        const lovs = await this.listOfValuesService.findAll(paginatedQuery);
        const selectionValues = lovs.map(lov => {
            return {
                label: lov.display,
                value: lov.value
            }
        });
        return selectionValues;
    }
}