import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, ManyToOne, JoinColumn, Unique } from 'typeorm'
import { ModuleMetadata } from 'src/entities/module-metadata.entity'

@Entity("ss_list_of_values")
@Unique(['type', 'value'])
export class ListOfValues extends CommonEntity {
    @Index()
    @Column({ type: "varchar" })
    type: string;

    @Index()
    @Column({ type: "varchar" })
    value: string;

    @Index()
    @Column({ type: "varchar" })
    display: string;

    @Column({ type: "varchar" })
    description: string;

    @Column({ nullable: true, default: false })
    default: boolean = false;

    @Column({ type: "integer", nullable: true })
    sequence: number;

    @Index()
    @ManyToOne(() => ModuleMetadata, { nullable: true })
    @JoinColumn()
    module: ModuleMetadata;
}
