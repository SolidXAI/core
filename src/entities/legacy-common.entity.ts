import { Exclude, Expose, Type } from "class-transformer";
import { Column, CreateDateColumn, DeleteDateColumn, Index, JoinColumn, ManyToOne, UpdateDateColumn } from "typeorm";
import type { User } from "./user.entity";

export const LEGACY_TABLE_FIELDS_PREFIX = 'ss';

@Exclude()
export abstract class LegacyCommonEntity {
    // @Expose()
    // @Column({ type: 'integer', name: `${LEGACY_TABLE_FIELDS_PREFIX}_id`, unique: true })
    // @Generated("increment")
    // id: number

    @CreateDateColumn({ name: `${LEGACY_TABLE_FIELDS_PREFIX}_created_at` })
    createdAt: Date;

    @UpdateDateColumn({ name: `${LEGACY_TABLE_FIELDS_PREFIX}_updated_at` })
    updatedAt: Date;

    @DeleteDateColumn({ name: `${LEGACY_TABLE_FIELDS_PREFIX}_deleted_at` })
    @Index()
    deletedAt: Date;

    @Column({ name: `${LEGACY_TABLE_FIELDS_PREFIX}_deleted_tracker`, default: "not-deleted" })
    deletedTracker: string;

    @Expose()
    @Column({ name: `${LEGACY_TABLE_FIELDS_PREFIX}_published_at`, default: null ,nullable: true})
    publishedAt: Date;

    @Expose()
    @Column({ type: "varchar", name: `${LEGACY_TABLE_FIELDS_PREFIX}_locale_name`, default: null })
    localeName: string;

    @Expose()
    @Column({ type: "int", name: `${LEGACY_TABLE_FIELDS_PREFIX}_default_entity_locale_id`, default: null })
    defaultEntityLocaleId: number;

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
    createdBy: number;
    
    @Expose()
    @Column({ name: `${LEGACY_TABLE_FIELDS_PREFIX}_updated_by_id`, nullable: true })
    updatedBy: number;
}
