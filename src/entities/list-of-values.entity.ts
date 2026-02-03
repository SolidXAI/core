import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm'
import { ModuleMetadata } from 'src/entities/module-metadata.entity'

@Entity("ss_list_of_values")
@Unique(['type', 'value'])
export class ListOfValues extends CommonEntity {
    @Column({ type: "varchar" })
    type: string;

    @Column({ type: "varchar" })
    value: string;

    @Column({ type: "varchar" })
    display: string;

    @Column({ type: "varchar" })
    description: string;

    @Column({ nullable: true, default: false })
    default: boolean = false;

    @Column({ type: "integer", nullable: true })
    sequence: number;

    @ManyToOne(() => ModuleMetadata, { nullable: true })
    @JoinColumn()
    module: ModuleMetadata;
}
