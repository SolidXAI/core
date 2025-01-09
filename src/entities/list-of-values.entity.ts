import { CommonEntity } from "src/entities/common.entity";
import { Column, Entity } from "typeorm";

@Entity("ss_list_of_values")
export class ListOfValues extends CommonEntity {
    @Column({ name: "type" })
    type: string;

    @Column({ name: "value" })
    value: string;

    @Column({ name: "display" })
    display: string;

    @Column({ name: "description" })
    description: string;

    @Column({ name: "default" })
    default: boolean;

    @Column({ name: "sequence" })
    sequence: number;
}