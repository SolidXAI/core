import { Injectable } from "@nestjs/common";
import { SelectionProvider } from "src/decorators/selection-provider.decorator";
import { IDashboardSelectionProvider, ISelectionProviderContext, ISelectionProviderValues } from "../../interfaces";
// import localeCodes from 'locale-codes';
import { EntityManager } from "typeorm";


@SelectionProvider()
@Injectable()
export class DasbhoardVariableTestDynamicProvider implements IDashboardSelectionProvider<ISelectionProviderContext> {

    constructor(private readonly entityManager: EntityManager) {
    }

    help(): string {
        return "# Get the dashboard variable values.\n";
    }

    name(): string {
        return 'DasbhoardVariableTestDynamicProvider';
    }

    async value(optionValue: string, ctxt: ISelectionProviderContext): Promise<ISelectionProviderValues | any> {
        throw new Error("DasbhoardVariableTestDynamicProvider does not support value method. Use values method instead.");
    }

    async values(query: string, ctxt: ISelectionProviderContext): Promise<readonly ISelectionProviderValues[]> {
        // Return some dummy data for testing
        const { sql, limit, offset } = ctxt as unknown as { sql: string, limit?: number, offset?: number };
        return [
            { value: '1', label: 'Option 1' },
            { value: '2', label: 'Option 2' },
            { value: '3', label: 'Option 3' },
            { value: '4', label: 'Option 4' },
        ]; 
    }

}