import { Injectable, BadRequestException } from "@nestjs/common";
import { SelectionProvider } from "src/decorators/selection-provider.decorator";
import {
  ISelectionProvider,
  ISelectionProviderContext,
  ISelectionProviderValues
} from "../../interfaces";
import { BasicFilterDto } from "src/dtos/basic-filters.dto";
import { RoleMetadataService } from "../role-metadata.service";

const DEFAULT_LIMIT = 100;

interface ListOfRolesProviderContext extends ISelectionProviderContext {
    filter?: {
        name?: {
            $eq?: string;
            $containsi?: string;
            $in?: string[];
            $notIn?: string[];
        };
    };
}

@SelectionProvider()
@Injectable()
export class ListOfRolesSelectionProvider implements ISelectionProvider<ListOfRolesProviderContext> {

    constructor(
        private readonly roleMetadataService: RoleMetadataService
    ) {}

    name(): string {
        return 'ListOfRolesSelectionProvider';
    }

    help(): string {
        return '# Simple Role selection provider (search + include/exclude)';
    }

    async value( optionValue: string, ctxt: ListOfRolesProviderContext ): Promise<ISelectionProviderValues> {
        
        const basicFilterQuery = new BasicFilterDto(1, 0);
        basicFilterQuery.filters = {
            name: { $eq: optionValue }
        };

        const roles = await this.roleMetadataService.find(basicFilterQuery);

        if (!roles.records || roles.records.length === 0) {
            throw new BadRequestException(
                `Invalid role name: ${optionValue}`
            );
        }

        const role = roles.records[0];

        return {
            label: role.name,
            value: role.name
        };
    }

    async values( query: string, ctxt: ListOfRolesProviderContext ): Promise<readonly ISelectionProviderValues[]> {

        const basicFilterQuery = new BasicFilterDto(DEFAULT_LIMIT, 0);
        
        basicFilterQuery.filters = ctxt.filter || {};

        const roles = await this.roleMetadataService.find(basicFilterQuery);

        return roles.records.map(role => ({
            label: role.name,
            value: role.name
        }));
    }
}