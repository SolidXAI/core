import { CommonEntity } from "src/entities/common.entity";
export declare class ListOfValues extends CommonEntity {
    type: string;
    value: string;
    display: string;
    description: string;
    default: boolean;
    sequence: number;
}
