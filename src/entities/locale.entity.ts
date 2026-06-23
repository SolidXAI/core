import { CommonEntity } from 'src/entities/common.entity'
import { Entity, Column, Index, ManyToOne } from 'typeorm';

@Entity("ss_locale")
export class Locale extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar" })
    locale: string;
    @Index()
    @Column({ type: "varchar" })
    displayName: string;
    @Index()
    @Column({ default: true })
    isDefault: boolean = true;
}