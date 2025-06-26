import { Injectable } from "@nestjs/common";
import { SelectionProvider } from "src/decorators/selection-provider.decorator";
import { ISelectionProvider, ISelectionProviderContext, ISelectionProviderValues } from "../../interfaces";
import { SolidRegistry } from "src/helpers/solid-registry";
import { IScheduledJob } from "../scheduled-jobs/scheduled-job.interface";


@SelectionProvider()
@Injectable()
export class ListOfScheduledJobsSelectionProvider implements ISelectionProvider<ISelectionProviderContext> {

    constructor(
        private readonly solidRegistry: SolidRegistry,
    ) {
    }

    help(): string {
        return "# Allows one to dynamically fetch all scheduled jobs";
    }

    name(): string {
        return 'ListOfScheduledJobsSelectionProvider';
    }

    async value(optionValue: string, ctxt: ISelectionProviderContext): Promise<ISelectionProviderValues | any> {
        const jobHandler: IScheduledJob | undefined = this.solidRegistry.getScheduledJobProviderInstance(optionValue);
        if (!jobHandler) {
            return null;
        }

        return { label: optionValue, value: optionValue };
    }

    async values(query: string, ctxt: ISelectionProviderContext): Promise<readonly ISelectionProviderValues[]> {
        const scheduledJobs = this.solidRegistry.getScheduledJobProviders()
        return scheduledJobs.map(i => {
            return { label: i.name, value: i.name };
        });
    }
}