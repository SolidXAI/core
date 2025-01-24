import { CommonEntity } from "src/entities/common.entity";
import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { ModelMetadata } from "./model-metadata.entity";

@Entity("ss_module_metadata")
export class ModuleMetadata extends CommonEntity {
    @Column({ name: "display_name" })
    displayName: string;

    @Index({ unique: true })
    @Column({ name: "name" })
    name: string;

    @Column({ nullable: true })
    description: string;

    @Column({ nullable: true })
    menuIconUrl: string;

    @Column({ nullable: true })
    menuSequenceNumber: number;

    @Column({ nullable: true })
    defaultDataSource: string;

    @OneToMany(() => ModelMetadata, (model) => model.module)
    models: ModelMetadata[];

    @Column({ default: false })
    isSystem: boolean;
}
