import { CommonEntity } from "src/entities/common.entity";
import { LegacyTableType } from "src/enums/legacy-table-type.enum";
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { FieldMetadata } from "./field-metadata.entity";
import { ModuleMetadata } from "./module-metadata.entity";

@Entity("ss_model_metadata")
export class ModelMetadata extends CommonEntity {
    @Index({ unique: true })
    @Column({ name: "singular_name" })
    singularName: string;

    @Index({ unique: true })
    @Column({ name: "table_name", nullable: true })
    tableName: string;

    @Index({ unique: true })
    @Column({ name: "plural_name" })
    pluralName: string;

    @Index()
    @Column({ name: "display_name" })
    displayName: string;

    @Index()
    @Column({ name: "description", nullable: true })
    description: string;

    @Column({ name: "data_source" })
    dataSource: string;

    /** mongo | postgres | mssql | mysql | oracle | mariadb */
    @Column({ name: "data_source_type" })
    dataSourceType: string;

    @Column({ name: "enable_soft_delete", default: false })
    enableSoftDelete: boolean;

    @Column({ name: "enable_audit_tracking", default: false })
    enableAuditTracking: boolean = false;

    @Column({ name: "internationalisation", default: false })
    internationalisation: boolean;

    @Column({ name: "draftPublishWorkflow", default: false })
    draftPublishWorkflow: boolean;

    @OneToMany(() => FieldMetadata, (field) => field.model)
    fields: FieldMetadata[];

    @Index()
    @ManyToOne(() => ModuleMetadata, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'module_id', referencedColumnName: 'id' })
    module: ModuleMetadata;

    // ExternalId
    // 1. Single field. 
    // 2. Composite field. 
    // 3. Auto generated human readable sequence. 
    @Index()
    @ManyToOne(() => FieldMetadata, {})
    userKeyField: FieldMetadata;

    @Column({ default: false })
    isSystem: boolean;

    @Column({ default: false })
    isChild: boolean;

    @ManyToOne(() => ModelMetadata, {})
    parentModel: ModelMetadata;

    @Column({ type: 'varchar', default: LegacyTableType.NONE })
    legacyTableType: LegacyTableType;

}
