import { CommonEntity } from 'src/entities/common.entity'
import {Entity, Column} from 'typeorm'
@Entity("ss_list_of_values")
export class ListOfValues extends CommonEntity{
@Column({ type: "varchar" })
type: string;

@Column({ type: "varchar" })
value: string;

@Column({ type: "varchar" })
display: string;

@Column({ type: "varchar" })
description: string;

@Column({ type: "boolean", nullable: true, default: false })
default: boolean = false;

@Column({ type: "int", nullable: true })
sequence: number;
}