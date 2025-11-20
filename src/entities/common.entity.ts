import { Column, CreateDateColumn, DeleteDateColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { User } from "./user.entity";
import { Exclude, Expose, Type } from "class-transformer";

@Exclude()
export abstract class CommonEntity {
    @Expose()
    @PrimaryGeneratedColumn({ type: 'integer' })
    id: number

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ name: "updated_at" })
    updatedAt: Date;

    @DeleteDateColumn({ name: "deleted_at" })
    deletedAt: Date;

    @Column({ name: "deletedTracker", default: "not-deleted" })
    deletedTracker: string;

    @Expose()
    @Column({ name: 'published_at', default: null ,nullable: true})
    publishedAt: Date;

    @Expose()
    @Column({ type: "varchar", name: 'locale_name', default: null })
    localeName: string;

    @Expose()
    @Column({ type: "int", name: 'default_entity_locale_id', default: null })
    defaultEntityLocaleId: number;

    @Expose()
    @Type( () => require('./user.entity').User?.default ?? require('./user.entity').User )
    @ManyToOne(() => require('./user.entity').User?.default ?? require('./user.entity').User, { onDelete: 'SET NULL', nullable: true })
    createdBy: User;

    @Expose()
    @Type( () => require('./user.entity').User?.default ?? require('./user.entity').User )
    @ManyToOne(() => require('./user.entity').User?.default ?? require('./user.entity').User, { onDelete: 'SET NULL', nullable: true })
    updatedBy: User;    
}
