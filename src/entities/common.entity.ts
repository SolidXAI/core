import { PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from "typeorm"

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
}
