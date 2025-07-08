import { Injectable } from "@nestjs/common";
import { IDashboardSelectionProvider, ISelectionProviderContext, ISelectionProviderValues } from "../../interfaces";
// import localeCodes from 'locale-codes';
import { EntityManager } from "typeorm";
import { DashboardSelectionProvider } from "src/decorators/dashboard-selection-provider.decorator";

@DashboardSelectionProvider()
@Injectable()
export class DashboardVariableSQLDynamicProvider implements IDashboardSelectionProvider<ISelectionProviderContext> {

    constructor(private readonly entityManager: EntityManager) {
    }

    help(): string {
        return "# Get the dashboard variable after executing the SQL query configured for the dashboard variable.\n";
    }

    name(): string {
        return 'DasbhoardVariableSQLDynamicProvider';
    }

    async value(optionValue: string, ctxt: ISelectionProviderContext): Promise<ISelectionProviderValues | any> {
        throw new Error("DasbhoardVariableSQLDynamicProvider does not support value method. Use values method instead.");
    }

    async values(query: string, ctxt: ISelectionProviderContext): Promise<readonly ISelectionProviderValues[]> {
        const { sql, limit, offset } = ctxt as unknown as { sql: string, limit?: number, offset?: number };
        if (!sql) {
            throw new Error("DasbhoardVariableSQLDynamicProvider requires a SQL query to be provided in the context.");
        }

        // Here you would execute the SQL query against your database
        // For demonstration, let's assume we have a mock database function that executes the SQL query
        const results = await this.entityManager.query(this.appendLimitOffset(sql), [limit, offset]);

        // Transform the results into the expected format
        return results.map((result: any) => {
            const transformedResult: ISelectionProviderValues = {
                value: result.value, // Assuming the result has a 'value' field
                label: result.label, // Assuming the result has a 'label' field
                // Add any other fields you need to transform here
            };
            return transformedResult;
        });
    }

    appendLimitOffset(sql: string): string {
        // Strip trailing semicolon if present
        const trimmedSql = sql.trim().replace(/;$/, '');

        // Append the LIMIT/OFFSET
        const finalSql = `${trimmedSql} LIMIT $1 OFFSET $2`; // FIXME This works with PostgreSQL. for mysql use ?. For this we will need to identify the datasource using the model for the particular dashboard variable

        return finalSql;
    }
}