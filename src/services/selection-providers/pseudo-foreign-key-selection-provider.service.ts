import { ListOfValuesService } from "../list-of-values.service";
import { SelectionProvider } from "src/decorators/selection-provider.decorator";
import { BadRequestException, Injectable } from "@nestjs/common";
import { ISelectionProvider, ISelectionProviderContext, ISelectionProviderValues } from "../../interfaces";
import { BasicFilterDto } from "src/dtos/basic-filters.dto";
import { SolidIntrospectService } from "../solid-introspect.service";
import { classify } from "@angular-devkit/core/src/utils/strings";
import { CRUDService } from "../crud.service";

interface PseudoForeignKeySelectionProviderContext extends ISelectionProviderContext {
    modelName: string;
    // ['countryName', 'countryCode'] - IN|INR
    whereClauseFields: string[];
    labelFieldName: string;
    valueFieldName: string;
}

const DEFAULT_LIMIT = 100;

@SelectionProvider()
@Injectable()
export class PseudoForeignKeySelectionProvider implements ISelectionProvider<PseudoForeignKeySelectionProviderContext> {
    constructor(
        private readonly listOfValuesService: ListOfValuesService,
        readonly introspectService: SolidIntrospectService,
    ) { }

    name(): string {
        return 'PseudoForeignKeySelectionProvider';
    }

    help(): string {
        return "# Use this provider to implement pseudo foreign key style relationships.";
    }

    async value(optionValue: string, ctxt: PseudoForeignKeySelectionProviderContext): Promise<ISelectionProviderValues | any> {
        const basicFilterQuery = new BasicFilterDto(DEFAULT_LIMIT, 0);
        basicFilterQuery.filters = {
            [ctxt.valueFieldName]: {
                $eq: optionValue
            }
        };

        const modelServiceInstanceWrapper = this.introspectService.getProvider(`${classify(ctxt.modelName)}Service`);
        if (!modelServiceInstanceWrapper) {
            throw new BadRequestException(`Invalid model name (${ctxt.modelName}) specified in PseudoForeignKeySelectionProvider context.`);
        }

        const modelService: CRUDService<any> = modelServiceInstanceWrapper.instance;
        const recs = await modelService.find(basicFilterQuery);
        if (!recs.records || recs.records.length == 0) {
            throw new Error(`Invalid optionValue=${optionValue}, for PseudoForeignKeySelectionProvider with context: ${JSON.stringify(ctxt)}`)
            // return null;
        }

        return {
            label: recs.records[0][ctxt.labelFieldName],
            value: recs.records[0][ctxt.valueFieldName]
        }
    }

    async values(query: string, ctxt: PseudoForeignKeySelectionProviderContext): Promise<readonly ISelectionProviderValues[]> {
        const basicFilterQuery = new BasicFilterDto(ctxt.limit, ctxt.offset);

        // Next we get hold of the userkey field in the parent model.
        if (query) {
            basicFilterQuery.filters = {
                $or: ctxt.whereClauseFields.map((whereClauseField) => {
                    return {
                        [whereClauseField]: {
                            $containsi: `%${query}%`
                        }
                    }
                })
            };
        }

        const modelServiceInstanceWrapper = this.introspectService.getProvider(`${classify(ctxt.modelName)}Service`);
        if (!modelServiceInstanceWrapper) {
            throw new BadRequestException(`Invalid model name (${ctxt.modelName}) specified in PseudoForeignKeySelectionProvider context.`);
        }

        const modelService: CRUDService<any> = modelServiceInstanceWrapper.instance;

        const recs = await modelService.find(basicFilterQuery);
        const selectionValues = recs.records.map(rec => {
            return {
                label: rec[ctxt.labelFieldName],
                value: rec[ctxt.valueFieldName]
            }
        });
        return selectionValues;
    }
}