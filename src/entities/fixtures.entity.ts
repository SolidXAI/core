import { CommonEntity } from 'src/entities/common.entity';
import { Entity, Column, Index } from 'typeorm'

@Entity('ss_fixtures')
export class Fixtures extends CommonEntity {
    @Index()
    @Column({ type: "varchar" })
    moduleName: string;
    @Index()
    @Column({ type: "varchar" })
    scenarioName: string;
    @Column({ type: "text", nullable: true })
    scenarioDescription: string;
    @Column({ type: "simple-json" })
    data: any;
    @Index({ unique: true })
    @Column({ type: "varchar" })
    checksum: string;
}