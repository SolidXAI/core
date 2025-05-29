import { PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index, ManyToOne, JoinColumn } from "typeorm"
import { Locale } from "./locale.entity";

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

    @Column({ type: "timestamp", name: 'published_at', default: null })
    publishedAt: Date;

    @Column({ type: "varchar", name: 'locale_name', default: null })
    localeName: string;

    @Column({ type: "int", name: 'default_locale_id', default: null })
    defaultEntityLocaleId: number;
}
