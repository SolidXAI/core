import { Column, CreateDateColumn, DeleteDateColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { User } from "./user.entity";

export abstract class CommonEntity {
    @PrimaryGeneratedColumn({ type: 'integer' })
    id: number

    @CreateDateColumn({ type: "timestamp", name: "created_at" })
    createdAt: Date;

    @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
    updatedAt: Date;

    @DeleteDateColumn({ type: "timestamp", name: "deleted_at" })
    deletedAt: Date;

    @Column({ name: "deletedTracker", default: "not-deleted" })
    deletedTracker: string;

    @Column({ type: "timestamp", name: 'published_at', default: null ,nullable: true})
    publishedAt: Date;

    @Column({ type: "varchar", name: 'locale_name', default: null })
    localeName: string;

    @Column({ type: "int", name: 'default_entity_locale_id', default: null })
    defaultEntityLocaleId: number;

    @ManyToOne(require('./user.entity').User, { nullable: true })
    createdBy: User;

    @ManyToOne(require('./user.entity').User, { nullable: true })
    updatedBy: User;    
}
