import { v4 as uuidv4 } from 'uuid';
import { Injectable } from "@nestjs/common";
import {  IEntityPreComputeFieldProvider } from "../../../interfaces";
import { CommonEntity } from 'src/entities/common.entity';
import { ComputedFieldMetadata } from 'src/helpers/solid-registry';
// @ComputedFieldProvider()
@Injectable()
export class NewUuidExternalIdComputedFieldProvider implements IEntityPreComputeFieldProvider<CommonEntity, any, string> {
    preComputeValue(triggerEntity: CommonEntity, computedFieldMetadata: ComputedFieldMetadata<any>): Promise<string> {
        throw new Error('Method not implemented.');
    }
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