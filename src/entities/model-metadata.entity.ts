import { CommonEntity } from "src/entities/common.entity";
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

    @Column({ name: "display_name" })
    displayName: string;

    @Column({ name: "description", nullable: true })
    description: string;

    @Column({ name: "data_source" })
    dataSource: string;

    /** mongo | postgres | mssql | mysql | oracle | mariadb */
    @Column({ name: "data_source_type" })
    dataSourceType: string;

    @Column({ name: "enable_soft_delete", default: true })
    enableSoftDelete: boolean;

    @Column({ name: "enable_audit_tracking", default: false })
    enableAuditTracking: boolean;

    @Column({ name: "internationalisation", default: false })
    internationalisation: boolean;

    @OneToMany(() => FieldMetadata, (field) => field.model)
    fields: FieldMetadata[];

    @Index()
    @ManyToOne(() => ModuleMetadata, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'module_id', referencedColumnName: 'id' })
    module: ModuleMetadata;

    @Column({ name: "is_exportable", default: false })
    isExportable: boolean;

    // ExternalId
    // 1. Single field. 
    // 2. Composite field. 
    // 3. Auto generated human readable sequence. 
    @ManyToOne(() => FieldMetadata, { onDelete: 'SET NULL' })
    userKeyField: FieldMetadata;

    @Column({ default: false })
    isSystem: boolean;
}
