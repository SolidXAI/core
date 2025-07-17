import { Injectable } from "@nestjs/common";
import { SelectionProvider } from "src/decorators/selection-provider.decorator";
import { SolidRegistry } from "src/helpers/solid-registry";
import { IDashboardVariableSelectionProvider, ISelectionProvider, ISelectionProviderContext, ISelectionProviderValues } from "../../interfaces";
import { SQL_DYNAMIC_PROVIDER_NAME } from "../dashboard.service";


@SelectionProvider()
@Injectable()
export class ListOfDashboardVariableProvidersSelectionProvider implements ISelectionProvider<ISelectionProviderContext> {

    constructor(
        private readonly solidRegistry: SolidRegistry,
    ) {
    }

    help(): string {
        return "# Allows one to dynamically fetch all the dashboard providers that are registered in the system. ";
    }

    name(): string {
        return 'ListOfDashboardVariableProvidersSelectionProvider';
    }

    async value(optionValue: string, ctxt: ISelectionProviderContext): Promise<ISelectionProviderValues | any> {
        const dashboardSelectionProvider: IDashboardVariableSelectionProvider<ISelectionProviderContext> | undefined = this.solidRegistry.getDashboardVariableSelectionProviderInstance(optionValue);
        if (!dashboardSelectionProvider) {
            return null;
        }

        return { label: dashboardSelectionProvider.name(), value: dashboardSelectionProvider.name() };
    }

    async values(query: string, ctxt: ISelectionProviderContext): Promise<readonly ISelectionProviderValues[]> {
        const dashboardSelectionProviders = this.solidRegistry.getDashboardVariableSelectionProviders()
        //Exclude the SQL dynamic provider from the list, (since although it is a dashboard selection provider, it is not a valid option for the user to select)
        return dashboardSelectionProviders.filter(i => (i.name !== SQL_DYNAMIC_PROVIDER_NAME)).map(i => {
            return { label: i.name, value: i.name };
        });
    }
}