
import { ListOfValuesService } from "../list-of-values.service";
import { PaginationQueryDto } from "src/dtos/pagination-query.dto";
import { SelectionProvider } from "src/decorators/selection-provider.decorator";
import { Injectable } from "@nestjs/common";
import { ISelectionProvider, ISelectionProviderContext, ISelectionProviderValues } from "../../interfaces";
import { filter } from "rxjs";
import { BasicFilterDto } from "src/dtos/basic-filters.dto";

interface ListOfValuesProviderContext extends ISelectionProviderContext {
    type: string;
}

const DEFAULT_LIMIT = 100;

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
        const basicFilterQuery = new BasicFilterDto(DEFAULT_LIMIT, 0);
        if (ctxt.type) {
            basicFilterQuery.filters = {
                type: {
                    $eq: ctxt.type
                }
            };
        }
        if (query) {
            basicFilterQuery.filters = {
                ...basicFilterQuery.filters,
                display: {
                    $containsi: `%${query}%`
                }
            };
        }
        const lovs = await this.listOfValuesService.find(basicFilterQuery);
        const selectionValues = lovs.records.map(lov => {
            return {
                label: lov.display,
                value: lov.value
            }
        });
        return selectionValues;
    }
}