import { Exclude, Expose } from "class-transformer";
import { LocalDateTimeTransformer } from "src/transformers/typeorm/local-date-time-transformer";
import { Column, CreateDateColumn, DeleteDateColumn, Index, UpdateDateColumn } from "typeorm";

export const LEGACY_TABLE_FIELDS_PREFIX = 'ss';

@Exclude()
export abstract class LegacyCommonEntity {
    // @Expose()
    // @Column({ type: 'integer', name: `${LEGACY_TABLE_FIELDS_PREFIX}_id`, unique: true })
    // @Generated("increment")
    // id: number

    @CreateDateColumn({ name: `${LEGACY_TABLE_FIELDS_PREFIX}_created_at`, transformer: LocalDateTimeTransformer, nullable: true })
    createdAt: Date | null;

    @UpdateDateColumn({ name: `${LEGACY_TABLE_FIELDS_PREFIX}_updated_at`, transformer: LocalDateTimeTransformer, nullable: true })
    updatedAt: Date | null;

    @DeleteDateColumn({ name: `${LEGACY_TABLE_FIELDS_PREFIX}_deleted_at`, transformer: LocalDateTimeTransformer, nullable: true })
    @Index()
    deletedAt: Date | null;

    @Column({ name: `${LEGACY_TABLE_FIELDS_PREFIX}_deleted_tracker`, default: "not-deleted", nullable: true })
    deletedTracker: string | null;

    @Expose()
    @Column({ name: `${LEGACY_TABLE_FIELDS_PREFIX}_published_at`, default: null, nullable: true, transformer: LocalDateTimeTransformer })
    publishedAt: Date | null;

    @Expose()
    @Column({ type: "varchar", name: `${LEGACY_TABLE_FIELDS_PREFIX}_locale_name`, default: null, nullable: true })
    localeName: string | null;

    @Expose()
    @Column({ type: "int", name: `${LEGACY_TABLE_FIELDS_PREFIX}_default_entity_locale_id`, default: null, nullable: true })
    defaultEntityLocaleId: number | null;

    // @Expose()
    // @Type( () => require('./user.entity').User?.default ?? require('./user.entity').User )
    // @ManyToOne(() => require('./user.entity').User?.default ?? require('./user.entity').User, { nullable: true })
    // @JoinColumn({ name: `${LEGACY_TABLE_FIELDS_PREFIX}_created_by_id` })
    // createdBy: User;

    // @Expose()
    // @Type( () => require('./user.entity').User?.default ?? require('./user.entity').User )
    // @ManyToOne(() => require('./user.entity').User?.default ?? require('./user.entity').User, { nullable: true })
    // @JoinColumn({ name: `${LEGACY_TABLE_FIELDS_PREFIX}_updated_by_id` })
    // updatedBy: User;    

    @Expose()
    @Column({ name: `${LEGACY_TABLE_FIELDS_PREFIX}_created_by_id`, nullable: true })
    createdBy: number | null;

    @Expose()
    @Column({ name: `${LEGACY_TABLE_FIELDS_PREFIX}_updated_by_id`, nullable: true })
    updatedBy: number | null;
}
