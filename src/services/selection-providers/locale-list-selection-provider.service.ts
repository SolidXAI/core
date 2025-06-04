import { Injectable } from "@nestjs/common";
import { ModelMetadataService } from "src/services/model-metadata.service";
import { SelectionProvider } from "src/decorators/selection-provider.decorator";
import { ISelectionProvider, ISelectionProviderContext, ISelectionProviderValues } from "../../interfaces";
// import localeCodes from 'locale-codes';
import * as locale from 'locale-codes'


@SelectionProvider()
@Injectable()
export class LocaleListSelectionProvider implements ISelectionProvider<ISelectionProviderContext> {

    constructor() {
    }

    help(): string {
        return "# Gets all locales available to the user";
    }

    name(): string {
        return 'LocaleListSelectionProvider';
    }

    async value(optionValue: string, ctxt: ISelectionProviderContext): Promise<ISelectionProviderValues | any> {
        const locales = locale.all
            .filter(code => code.tag === optionValue)
            .map(code => ({ label: `${code.name} (${code.tag})`, value: code.tag }));

        return locales.length > 0 ? locales[0] : null;
    }

    async values(query: string, ctxt: ISelectionProviderContext): Promise<readonly ISelectionProviderValues[]> {

        const locales = locale.all
            .filter(code => {
                // Look at the documentation here - https://www.npmjs.com/package/locale-codes
                // In this if you check the section - https://www.npmjs.com/package/locale-codes#locale-list

                // We disabled this because this was not returning the basic locale codes like 'en', 'fr', etc.
                // We are only interested in the locales that have a tag with a hyphen (-) in it.
                // if (code.tag.includes('-')) {
                if (query) {
                    const lowerCaseQuery = query.toLowerCase();
                    return code.name.toLowerCase().includes(lowerCaseQuery) || code.tag.toLowerCase().includes(lowerCaseQuery);
                }
                return true;
                // }
                return false;
            })
            .map(code => ({
                label: `${code.name} (${code.tag})`,
                value: code.tag,
            }));

        return locales;

    }
}