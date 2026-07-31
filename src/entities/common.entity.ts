import { Exclude, Expose } from "class-transformer";
import { LocalDateTimeTransformer } from "src/transformers/typeorm/local-date-time-transformer";
import { Column, CreateDateColumn, DeleteDateColumn, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Exclude()
export abstract class CommonEntity {
    @Expose()
    @PrimaryGeneratedColumn({ type: 'integer' })
    id: number

    @CreateDateColumn({ name: "created_at", transformer: LocalDateTimeTransformer })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at", transformer: LocalDateTimeTransformer })
    updatedAt: Date;

    @DeleteDateColumn({ name: "deleted_at", transformer: LocalDateTimeTransformer })
    @Index()
    deletedAt: Date;

    @Column({ name: "deletedTracker", default: "not-deleted" })
    deletedTracker: string;

    @Expose()
    @Column({ name: 'published_at', default: null, nullable: true, transformer: LocalDateTimeTransformer })
    publishedAt: Date;

    // Optional (not just nullable) because legacy tables (see LegacyCommonEntityWithExistingId)
    // don't carry these versioning columns at all. CRUDService<T extends CommonEntity> is
    // otherwise used for both plain and legacy entities, so these must stay structurally
    // satisfiable by a type that never declares them.
    @Expose()
    @Column({ name: 'is_published', default: false })
    @Index()
    isPublished?: boolean;

    @Expose()
    @Column({ name: 'is_latest', default: true })
    @Index()
    isLatest?: boolean;

    @Expose()
    @Column({ type: "int", name: 'initial_entity_version_id', default: null, nullable: true })
    @Index()
    initialEntityVersionId?: number;

    @Expose()
    @Column({ name: 'published_tracker', default: "na" })
    @Index()
    publishedTracker?: string;

    @Expose()
    @Column({ type: "varchar", name: 'locale_name', default: null })
    localeName: string;

    @Expose()
    @Column({ type: "int", name: 'default_entity_locale_id', default: null })
    defaultEntityLocaleId: number;

    // @Expose()
    // @Type( () => require('./user.entity').User?.default ?? require('./user.entity').User )
    // @ManyToOne(() => require('./user.entity').User?.default ?? require('./user.entity').User, { nullable: true })
    // createdBy: User;

    // @Expose()
    // @Type( () => require('./user.entity').User?.default ?? require('./user.entity').User )
    // @ManyToOne(() => require('./user.entity').User?.default ?? require('./user.entity').User, { nullable: true })
    // updatedBy: User;

    @Expose()
    @Column({ name: `created_by_id`, nullable: true })
    createdBy: number;

    @Expose()
    @Column({ name: `updated_by_id`, nullable: true })
    updatedBy: number;
}
