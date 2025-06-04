import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, ManyToOne } from 'typeorm';

@Entity("ss_locale")
export class Locale extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    locale: string;
    @Column({ type: "varchar" })
    displayName: string;
    @Index()
    @Column({ type: "boolean", default: true })
    isDefault: boolean = true;
}