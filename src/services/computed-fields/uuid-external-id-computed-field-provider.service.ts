import { v4 as uuidv4 } from 'uuid';
import { Injectable } from "@nestjs/common";
import { ComputedFieldProvider } from "src/decorators/computed-field-provider.decorator";

import { IComputedFieldProvider } from "../../interfaces";

@ComputedFieldProvider()
@Injectable()
export class UuidExternalIdComputedFieldProvider implements IComputedFieldProvider<any> {

    name(): string {
        return "UuidExternalIdComputedFieldProvider";
    }

    help(): string {
        return "Computed field provider used to compute the external id field as a UUID.";
    }

    valueType(): string {
        return "string";
    }

    async computeValue(dto: any, ctxt: any): Promise<string> {
        const prefix = ctxt.prefix;
        return `${prefix}-${uuidv4()}`;
    }

}