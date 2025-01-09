import { IComputedFieldProvider } from "../../interfaces";
export declare class UuidExternalIdComputedFieldProvider implements IComputedFieldProvider<any> {
    name(): string;
    help(): string;
    valueType(): string;
    computeValue(dto: any, ctxt: any): Promise<string>;
}
