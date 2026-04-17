import { ComputedFieldTriggerConfig } from "src/dtos/create-field-metadata.dto";
import { CommonEntity } from "src/entities/common.entity";
import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { MediaStorageProviderMetadata } from "./media-storage-provider-metadata.entity";
import { ModelMetadata } from "./model-metadata.entity";
import { ERROR_MESSAGES } from "src/constants/error-messages";

@Entity("ss_field_metadata")
export class FieldMetadata extends CommonEntity {

    // @Index({ unique: true })
    @Column({ name: "name" })
    name: string;

    @Column({ name: "display_name" })
    displayName: string;

    @Column({ name: "description", nullable: true, length: 1024 })
    description: string;

    /** int, char etc... */
    @Column({ name: 'type' })
    type: string;

    @Column({ name: 'orm_type', nullable: true })
    ormType: string;

    @Index()
    @ManyToOne(() => ModelMetadata, (model) => model.fields, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'model_id', referencedColumnName: 'id' })
    model: ModelMetadata;

    @Column({ name: 'default_value', nullable: true })
    defaultValue: string;

    @Column({ name: 'regex_pattern', nullable: true })
    regexPattern: string;

    @Column({ name: 'regex_pattern_not_matching_error_msg', nullable: true, default: ERROR_MESSAGES.DEFAULT_REGEX_PATTERN_NOT_MATCHING_ERROR_MSG })
    regexPatternNotMatchingErrorMsg: string;

    @Column({ name: "required", default: false })
    required: boolean;

    @Column({ name: "unique", default: false })
    unique: boolean;

    @Column({ name: "encrypt", default: false })
    encrypt: boolean;

    @Column({ name: 'encryption_type', nullable: true })
    encryptionType: string;

    @Column({ name: 'decrypt_when', nullable: true })
    decryptWhen: string;

    @Column({ name: "index", default: false })
    index: boolean;

    @Column({ name: 'length', nullable: true })
    length: number;

    @Column({ name: 'max', nullable: true })
    max: number;

    @Column({ name: 'min', nullable: true })
    min: number;

    @Column({ name: "private", default: false })
    private: boolean;

    @Column({ name: 'media_types', nullable: true, type: "simple-json" })
    mediaTypes: string[];

    @Column({ name: 'media_max_size_kb', nullable: true })
    mediaMaxSizeKb: number;

    @ManyToOne(() => MediaStorageProviderMetadata, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'media_storage_provider_id' })
    mediaStorageProvider: MediaStorageProviderMetadata;

    // @Column({ name: 'media_embedded', default: true })
    // mediaEmbedded: boolean;

    @Column({ name: 'relation_type', nullable: true })
    relationType: string;

    @Column({ name: 'relation_model_singular_name', nullable: true })
    relationCoModelSingularName: string;

    @Column({ name: "relation_create_inverse", default: false })
    relationCreateInverse: boolean;

    @Column({ name: "relation_cascade", nullable: true })
    relationCascade: string;

    @Column({ name: 'relation_model_module_name', nullable: true })
    relationModelModuleName: string;

    // This field will be used to set the inverse field name in the related model e.g required for many to many relation
    @Column({ name: 'relation_model_field_name', nullable: true })
    relationCoModelFieldName: string;

    @Column({ name: 'is_relation_many_to_many_owner', nullable: true })
    isRelationManyToManyOwner: boolean;

    // We can store a filter json like this {"fieldName": ${someVarWhichWillComeFromParentModel... or can be hard coded...}}
    // {"type": "INDUSTRY"} .... Eg. static fixedFilter 
    // {"country_id", "${country}"} ... Eg. dynamic fixedFilter 
    @Column({ name: 'relation_field_fixed_filter', nullable: true })
    relationFieldFixedFilter: string;

    @Column({ name: 'selection_dynamic_provider', nullable: true })
    selectionDynamicProvider: string;

    @Column({ name: 'selection_dynamic_provider_ctxt', nullable: true })
    selectionDynamicProviderCtxt: string;

    @Column({ name: 'selection_static_values', nullable: true, type: 'simple-array' })
    selectionStaticValues: string[];

    @Column({ name: 'selection_value_type', nullable: true, default: 'string' })
    selectionValueType: string = 'string';

    // @Column({ name: "computed", default: false })
    // computed: boolean;

    @Column({ name: 'computed_field_value_provider', nullable: true })
    computedFieldValueProvider: string;

    @Column({ name: 'computed_field_value_provider_ctxt', nullable: true })
    computedFieldValueProviderCtxt: string;

    @Column({ name: 'computed_field_value_type', nullable: true })
    computedFieldValueType: string;

    @Column({ name: 'computed_field_trigger_config', nullable: true, type: 'simple-json' })
    computedFieldTriggerConfig: ComputedFieldTriggerConfig[];

    @Column({ name: 'uuid', nullable: true })
    uuid: string;

    @Column({ default: false })
    isSystem: boolean;

    @Column({ default: false })
    isMarkedForRemoval: boolean;

    @Column({ name: 'column_name', nullable: true })
    columnName: string;

    @Column({ name: 'relation_co_model_column_name', nullable: true })
    relationCoModelColumnName: string;

    @Column({ name: "is_user_key", default: false })
    isUserKey: boolean;

    @Column({ name: 'relation_join_table_name', nullable: true })
    relationJoinTableName: string;

    @Column({ name: 'enable_audit_tracking', default: false })
    enableAuditTracking: boolean = false;

    @Column({ name: "is_multiSelect", default: false })
    isMultiSelect: boolean;

    @Column({ name: "is_primary_key", default: false })
    isPrimaryKey: boolean;
}