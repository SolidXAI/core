import { CommonEntity } from 'src/entities/common.entity'
import {Entity, Column, Index} from 'typeorm'

@Entity("ss_setting")
export class Setting extends CommonEntity {
    @Index({ unique: true })
    @Column({ type: "varchar", nullable: true })
    keys: string;
    @Column({ type: "varchar", nullable: true })
    values: string;
}