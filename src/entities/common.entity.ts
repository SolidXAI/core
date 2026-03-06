import { Column, CreateDateColumn, DeleteDateColumn, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Exclude, Expose } from "class-transformer";
import { UtcDateTimeTransformer } from "src/transformers/typeorm/local-date-time-transformer";

@Exclude()
export abstract class CommonEntity {
    @Expose()
    @PrimaryGeneratedColumn({ type: 'integer' })
    id: number

    @CreateDateColumn({ name: "created_at", transformer: UtcDateTimeTransformer })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at", transformer: UtcDateTimeTransformer })
    updatedAt: Date;

    @DeleteDateColumn({ name: "deleted_at", transformer: UtcDateTimeTransformer })
    @Index()
    deletedAt: Date;

    @Column({ name: "deletedTracker", default: "not-deleted" })
    deletedTracker: string;

    @Expose()
    @Column({ name: 'published_at', default: null, nullable: true, transformer: UtcDateTimeTransformer })
    publishedAt: Date;

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
